const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');
const CalendarTool = require('../utils/calendarTool');
const leaveConfig = require('../utils/leaveConfig');
const { extractJsonObject } = require('../utils/utils');

module.exports = {
	metadata: {
		name: 'extractor_v3',
		properties: {},
		supportedActions: ['prompt', 'extraction'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Extractor: Invoked');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const userProfile = ctxManager.getUserProfile();
		const calendarTool = new CalendarTool({ useLlama: true });
		const dateInfo = await calendarTool.interpretDateQuery(userMessage);

		ctxManager.setDateInterpretation(dateInfo);

		logger.info('Extractor: Date interpretation', JSON.stringify(dateInfo));
		const existingData = ctxManager.getExtractedInfo();
		logger.info('Extractor: Existing data', existingData);
		logger.info('Extractor: User Message', userMessage);
		logger.info('Extractor: User Profile', userProfile);

		const extractionPreambleOverride = generateExtractionPreamble(
			existingData,
			userProfile
		);
		const prompt = `<|begin_of_text|><|start_header_id|>User Query<|end_header_id|>
${userMessage}
<|eot_id|>
<|start_header_id|>Date Interpretation<|end_header_id|>
${JSON.stringify(dateInfo)}
<|eot_id|>
<|start_header_id|>Existing Information<|end_header_id|>
${JSON.stringify(existingData)}
<|eot_id|>
<|start_header_id|>Conversation History<|end_header_id|>
${ctxManager.getConversationHistory()}
<|eot_id|>`;

		const useLlama = ctxManager.getUseLlama();
		const chatResponse = await chat(prompt, {
			maxTokens: 600,
			temperature: 0,
			docs: [
				{
					title: 'Sick Leave',
					text: 'Used if the employee is unable to attend work due to a medical reason, such as they are ill, or have to attend a medical appointment',
				},
				{
					title: 'Annual Leave',
					text: 'The employee can take annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work. This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
				},
				{
					title: 'Remote Working',
					text: 'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
				},
			],
			preambleOverride: extractionPreambleOverride,
			chatHistory: ctxManager.getConversationHistory(),
			useLlama: useLlama,
		});

		let extractedData = extractData(chatResponse, useLlama);
		logger.info('Extractor: Raw extracted data', extractedData);

		const mergedData = mergeData(existingData, extractedData, dateInfo);
		logger.info('Extractor: Merged data', mergedData);

		if (mergedData.startDate && mergedData.endDate) {
			mergedData.workingDays = dateInfo.workingDays;
		}

		ctxManager.setExtractedInfo(mergedData);

		const nullInfo = updateNullInfo(
			ctxManager.getNullExtractedInfo(),
			extractedData
		);
		logger.info('Extractor: Null info', nullInfo);
		ctxManager.setNullExtractedInfo(nullInfo);

		if (mergedData.leaveType && !mergedData.paramsPopulated) {
			logger.info(
				`Extractor: Populating parameters for ${mergedData.leaveType}`
			);
			const result = ctxManager.populateLeaveTypeParams(mergedData.leaveType);

			if (result) {
				const {
					extractedInfo: updatedExtractedInfo,
					nullExtractedInfo: updatedNullExtractedInfo,
				} = result;
				logger.info('Extractor: Updated Extracted Info', updatedExtractedInfo);
				logger.info(
					'Extractor: Updated Null Extracted Info',
					updatedNullExtractedInfo
				);

				updatedExtractedInfo.paramsPopulated = true;
				ctxManager.setExtractedInfo(updatedExtractedInfo);
				ctxManager.setNullExtractedInfo(updatedNullExtractedInfo);

				ctxManager.transition('extraction');
				ctxManager.addToConversationHistory(
					'CHATBOT',
					JSON.stringify(updatedExtractedInfo)
				);
				done();
				return;
			} else {
				logger.warn(
					`Extractor: Unable to populate parameters for ${mergedData.leaveType}`
				);
			}
		}

		ctxManager.transition('prompt');
		done();
	},
};

function extractData(chatResponse, useLlama) {
	if (useLlama) {
		const rawContent =
			chatResponse.chatResponse.choices[0].message.content[0].text
				.replace(/`/g, '')
				.replace('json', '')
				.replace(/\\n/g, '')
				.trim();
		const jsonString = extractJsonObject(rawContent);
		return jsonString ? JSON.parse(jsonString) : null;
	} else {
		return JSON.parse(chatResponse.chatResponse.text);
	}
}

function mergeData(existingData, extractedData, dateInfo) {
	const mergedData = { ...existingData };
	Object.keys(extractedData).forEach((key) => {
		if (extractedData[key] !== null) {
			mergedData[key] = extractedData[key];
		}
	});

	if (dateInfo.interpretedStartDate) {
		mergedData.startDate = Array.isArray(dateInfo.interpretedStartDate)
			? dateInfo.interpretedStartDate[0]
			: dateInfo.interpretedStartDate;
	}
	if (dateInfo.interpretedEndDate) {
		mergedData.endDate = Array.isArray(dateInfo.interpretedEndDate)
			? dateInfo.interpretedEndDate[0]
			: dateInfo.interpretedEndDate;
	}

	return mergedData;
}

function updateNullInfo(nullInfo, extractedData) {
	const updatedNullInfo = { ...nullInfo };
	Object.keys(extractedData).forEach((key) => {
		updatedNullInfo[key] = extractedData[key] === null;
	});
	return updatedNullInfo;
}

function generateExtractionPreamble(existingData, userProfile) {
	let preamble = `<|begin_of_text|><|start_header_id|>System<|end_header_id|>	
You are an AI assistant for an HRMS Leave Management system. Your task is to extract ONLY explicitly mentioned information from the user's query about a single leave request. Do not make any assumptions or inferences.

<<INSTRUCTIONS>>
1. WHILE HANDLING DATES CONSIDER ONLY THE WORKING DAYS i.e. MONDAY TO FRIDAY. IF THE USER IS ASKING TO TAKE LEAVE ON A WEEKEND, ADJUST IT TO THE FOLLOWING MONDAY.
2. IF USER MENTIONS A DATE IN THE PAST, ADJUST IT TO THE NEXT AVAILABLE WEEKDAY.
3. IF USER MENTIONS A DATE RANGE, THEN CHECK FOR THE STARTING DATE AND ENDING DATE, IF THEY ARE WEEKENDS, ADJUST THEM TO THE NEXT AVAILABLE WEEKDAYS.
4. HANDLE THE CASES WHERE THE USER MENTIONS A SINGLE DATE, DECLARE IT BOTH START AND END DATE.
5. DO NOT CREATE NEW KEY FIELDS (RESTRICTED TO EXISTING KEYS).
6. HANDLE THE CASE WHERE THE USER MIGHT BE ASKING FOR HALF DAY LEAVE.
7. IF THE USER IS ASKING TO TAKE HALF DAY LEAVE, CHECK THE START DAY TYPE AND END DAY TYPE PARAMETERS. UPDATE THEM ACCORDINGLY. TRUE FOR FULL DAY, FALSE FOR HALF DAY.
8. USE CAMEL CASE FOR THE KEYS like leaveType, startDate, endDate, etc.
9. IF NO PARAMETERS ARE EXPLICITLY MENTIONED, JUST PROVIDE AN EMPTY JSON OBJECT i.e. {}.
10. Extract ONLY the explicitly mentioned leave request information based on the given instructions. Do NOT include any information that is not explicitly stated in the user's query. Consider the user's profile when extracting information.
11. Use the date interpretation provided by the Calendar Tool for the start and end dates for the leave request. Do not perform any date calculations or adjustments yourself.
12. Pay special attention to half-day leave requests and update the startDayType and endDayType accordingly.
13. Only extract dates that are weekdays (Monday to Friday). Ignore any weekend dates mentioned in the query.
14. If a date has been adjusted due to falling on a weekend, use the adjusted date in your extraction.
<<INSTRUCTIONS>>

<<PARAMETERS>>
Extract ONLY the following parameters if EXPLICITLY mentioned:
1. Leave Type: The type of leave requested (e.g., Annual Leave, Sick Leave, Remote Working).
2. Start Date: The start date of the leave in YYYY-MM-DD format, ONLY if explicitly stated. (If the user mentions leave on a weekend, adjust it to the following Monday)
3. End Date: The end date of the leave in YYYY-MM-DD format, ONLY if explicitly stated. (If the user mentions leave on a weekend, adjust it to the following Monday)
4. Start Day Type: Whether the start date is a full day or half day, ONLY if explicitly mentioned.
5. End Day Type: Whether the end date is a full day or half day, ONLY if explicitly mentioned.
<<PARAMETERS>>

<<NOTE>>
IF NO PARAMETERS ARE EXPLICITLY MENTIONED, JUST PROVIDE AN EMPTY JSON OBJECT i.e. {}.
Extract ONLY the explicitly mentioned leave request information based on the given instructions. Do NOT include any information that is not explicitly stated in the user's query. Consider the user's profile when extracting information.
Use the date interpretation provided by the Calendar Tool for the start and end dates for the leave request. Do not perform any date calculations or adjustments yourself.
Pay special attention to half-day leave requests and update the startDayType and endDayType accordingly.
IMPORTANT: Only extract dates that are weekdays (Monday to Friday). Ignore any weekend dates mentioned in the query.
IMPORTANT: If a date has been adjusted due to falling on a weekend, use the adjusted date in your extraction.
<<NOTE>>
<|eot_id|>
<|begin_of_text|><|start_header_id|>Additional Information<|end_header_id|>
`;
	console.log('Extractor: Existing leave type', existingData);
	if (existingData.leaveType) {
		const leaveTypeConfig = leaveConfig[existingData.leaveType];
		if (leaveTypeConfig) {
			preamble += `\n\n<<ADDITIONAL PARAMETERS>>\nAdditional parameters for ${existingData.leaveType}:`;
			preamble += '\n\n<<MANDATORY PARAMS>>';
			leaveTypeConfig.mandatoryParams.forEach((param) => {
				if (param.name !== 'startDate' && param.name !== 'endDate') {
					preamble += `\n- ${param.name}: ${param.description}`;
				}
			});
			preamble += '\n\n<<OPTIONAL PARAMS>>';
			leaveTypeConfig.optionalParams.forEach((param) => {
				preamble += `\n- ${param.name}: ${param.description}`;
			});
			preamble += `\n<<ADDITIONAL PARAMETERS>>`;
		}
	}

	preamble += `\n<<RESPONSE FORMAT>>\nRespond with the extracted information in JSON format. Include ONLY the fields that are explicitly mentioned in the user's query. Do not include any assumed or inferred information. Use CamelCase for the keys.
IMPORTANT: Do NOT assume or infer any dates or information. Only extract what is explicitly stated in the user's message.
<<RESPONSE FORMAT>>
<|eot_id|>`;

	return preamble;
}
