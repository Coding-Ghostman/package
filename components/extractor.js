const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');
const CalendarTool = require('../utils/calendarTool');
const leaveConfig = require('../utils/leaveConfig');

module.exports = {
	metadata: {
		name: 'extractor_v3',
		properties: {},
		supportedActions: ['router', 'prompt'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Extractor: Invoked');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const userProfile = ctxManager.getUserProfile();
		const calendarTool = new CalendarTool();
		const dateInfo = calendarTool.interpretDateQuery(userMessage);
		logger.info('Extractor: Date interpretation', dateInfo);
		const existingData = ctxManager.getExtractedInfo();
		logger.info('Extractor: Existing data', existingData);
		logger.info('Extractor: User Message', userMessage);
		logger.info('Extractor: User Profile', userProfile);

		const extractionPreambleOverride = generateExtractionPreamble(
			existingData,
			userProfile
		);

		const prompt = `
User Query: ${userMessage}
Date Interpretation: ${JSON.stringify(dateInfo)}
Existing Information: ${JSON.stringify(existingData)}
User Profile: ${JSON.stringify(userProfile)}

Extract ONLY the explicitly mentioned leave request information based on the given instructions. Do NOT include any information that is not explicitly stated in the user's query. Consider the user's profile when extracting information.`;

		const chatResponse = await chat(prompt, {
			maxTokens: 600,
			temperature: 0,
			docs: [
				{
					title: 'Sick',
					text: 'Used if the employee is unable to attend work due to a medical reason, such as they are ill, or have to attend a medical appointment',
				},
				{
					title: 'Annual',
					text: 'The employee can take annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work. This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
				},
				{
					title: 'Remote',
					text: 'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
				},
			],
			preambleOverride: extractionPreambleOverride,
			chatHistory: ctxManager.getConversationHistory(),
		});

		let extractedData = JSON.parse(
			chatResponse.chatResponse.text
				.replace(/`/g, '')
				.replace('json', '')
				.replace(/\\n/g, '')
				.trim()
		);
		logger.info('Extractor: Raw extracted data', extractedData);

		// Post-processing step to remove any potentially assumed dates
		// const extractedData = removeAssumedDates(extractedData, userMessage);
		logger.info('Extractor: Cleaned extracted data', extractedData);

		// Modify the merging process
		const mergedData = { ...existingData };
		Object.keys(extractedData).forEach((key) => {
			if (extractedData[key] !== null) {
				mergedData[key] = extractedData[key];
			}
		});

		logger.info('Extractor: Merged data', mergedData);

		// Calculate working days only if both dates are present
		if (mergedData.startDate && mergedData.endDate) {
			mergedData.workingDays = calendarTool.getWorkingDays(
				mergedData.startDate,
				mergedData.endDate
			);
		}

		// Update the context with the merged data
		ctxManager.setExtractedInfo(mergedData);

		// Update null extracted info
		const nullInfo = { ...ctxManager.getNullExtractedInfo() };
		Object.keys(extractedData).forEach((key) => {
			nullInfo[key] = extractedData[key] === null;
		});
		logger.info('Extractor: Null info', nullInfo);
		ctxManager.setNullExtractedInfo(nullInfo);

		// After extraction logic
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

				// Transition back to extraction for another round
				ctxManager.transition('extraction');
				done();
				return;
			} else {
				logger.warn(
					`Extractor: Unable to populate parameters for ${mergedData.leaveType}`
				);
			}
		}

		// If extraction is complete, transition to prompt
		ctxManager.transition('prompt');
		done();
	},
};

function generateExtractionPreamble(existingData, userProfile) {
	let preamble = `You are an AI assistant for an HRMS Leave Management system. Your task is to extract ONLY explicitly mentioned information from the user's query about a single leave request. Do not make any assumptions or inferences.

	INSTRUCTIONS: WHILE HANDLING DATES CONSIDER ONLY THE WORKING DAYS i.e. MONDAY TO FRIDAY. IF THE USER IS ASKING TO TAKE LEAVE ON A WEEKEND, IGNORE THE REQUEST.

	IMPORTANT: DO NOT CREATE NEW KEY FIELDS (RESTRICTED TO EXISTING KEYS).
	IMPORTANT: HANDLE THE CASES WHERE THE USER MENTIONS THE SAME DATE FOR START AND END DATES.
	IMPORTANT: HANDLE THE CASE WHERE THE USER MIGHT BE ASKING FOR HALF DAY LEAVE.
	IMPORTANT: IF THE USER IS ASKING TO TAKE HALF DAY LEAVE, CHECK THE START DAY TYPE AND END DAY TYPE PARAMETERS. UPDATE THEM ACCORDINGLY. TRUE FOR FULL DAY, FALSE FOR HALF DAY.
	IMPORTANT: CONSIDER THE USER'S PROFILE WHEN EXTRACTING INFORMATION, ESPECIALLY FOR LEAVE TYPES AND DESTINATIONS.
	IMPORTANT: USE CAMEL CASE FOR THE KEYS like leaveType, startDate, endDate, etc.

	Extract ONLY the following parameters if EXPLICITLY mentioned:

	1. Leave Type: The type of leave requested (e.g., Annual Leave, Sick Leave, Remote Working).
	2. Start Date: The start date of the leave in YYYY-MM-DD format, ONLY if explicitly stated.
	3. End Date: The end date of the leave in YYYY-MM-DD format, ONLY if explicitly stated.
	4. Start Day Type: Whether the start date is a full day or half day, ONLY if explicitly mentioned.
	5. End Day Type: Whether the end date is a full day or half day, ONLY if explicitly mentioned.

	IF NO PARAMETERS ARE EXPLICITLY MENTIONED, JUST PROVIDE AN EMPTY JSON OBJECT i.e. {}.



	User Profile:
	${JSON.stringify(userProfile)}
	`;

	console.log('Extractor: Existing leave type', existingData);
	if (existingData.leaveType) {
		const leaveTypeConfig = leaveConfig[existingData.leaveType];
		if (leaveTypeConfig) {
			preamble +=
				'\n\nAdditional parameters for ' + existingData.leaveType + ':';
			leaveTypeConfig.mandatoryParams.forEach((param) => {
				if (param.name !== 'startDate' && param.name !== 'endDate') {
					preamble += `\n- ${param.name}: ${param.description}`;
				}
			});
			leaveTypeConfig.optionalParams.forEach((param) => {
				preamble += `\n- ${param.name}: ${param.description}`;
			});
		}
	}

	preamble += `\n\nRespond with the extracted information in JSON format. Include ONLY the fields that are explicitly mentioned in the user's query. Do not include any assumed or inferred information. Use CamelCase for the keys.

	IMPORTANT: Do NOT assume or infer any dates or information. Only extract what is explicitly stated in the user's message.`;

	return preamble;
}