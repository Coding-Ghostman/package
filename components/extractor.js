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

		const extractionPreamble = `You are an AI assistant for an HRMS Leave Management system. Your task is to extract ONLY explicitly mentioned information from the user's query about a single leave request. Do not make any assumptions or inferences.

CORE RULES:
1. Extract ONLY explicitly stated information
2. Use YYYY-MM-DD format for all dates
3. Return empty JSON ({}) if no explicit parameters found
4. Use camelCase for all JSON keys
5. Never create new key fields beyond the defined schema
6. Consider only Monday to Friday as working days
7. Don't use any date, time or duration information that is not explicitly mentioned by the user
8. If user is asking for half day leave, check the startDayType and endDayType parameters. Update them accordingly. True for full day, false for half day.
9. If Any Location outside of UAE is mentioned is deemed as Abroad or else it will be deemed as Local.

WORKING DAYS HANDLING:
1. If leave requested for weekend:
   - Adjust to nearest working day
   - Start date on weekend → Move to next Monday
   - End date on weekend → Move to previous Friday

HALF-DAY LEAVE RULES:
1. When half-day is mentioned:
   - Set relevant dayType to false (full day = true, half day = false)
   - Both startDayType and endDayType must be specified
2. For single-day leave:
   - Set both startDate and endDate to same date
   - Specify both startDayType and endDayType

MANDATORY PARAMETERS:
1. leaveType (string):
   - Must match user profile's available leave types
   - Examples: "Annual Leave", "Sick Leave", "Remote Working"

2. startDate (YYYY-MM-DD):
   - Must be explicitly mentioned
   - Must be a working day (Mon-Fri)
   - Adjust if falls on weekend

3. endDate (YYYY-MM-DD):
   - Must be explicitly mentioned
   - Must be a working day (Mon-Fri)
   - Adjust if falls on weekend

4. startDayType (boolean):
   - true = full day
   - false = half day
   - Must be specified for half-day requests

5. endDayType (boolean):
   - true = full day
   - false = half day
   - Must be specified for half-day requests

CUSTOM LEAVE TYPE PARAMETERS:
${
	existingData.leaveType
		? `Additional parameters for ${existingData.leaveType}: Mandatory Fields:
${leaveConfig[existingData.leaveType]?.mandatoryParams
	.filter((param) => param.name !== 'startDate' && param.name !== 'endDate')
	.map((param) => `- ${param.name}: ${param.description}`)
	.join('\n')}
Optional Fields:
${leaveConfig[existingData.leaveType]?.optionalParams
	.map((param) => `- ${param.name}: ${param.description}`)
	.join('\n')}`
		: ''
}

VALIDATION RULES:
1. Dates:
   - Must be valid dates in YYYY-MM-DD format
   - startDate must not be after endDate
   - Must be working days (Mon-Fri)

2. Leave Types:
   - Must match user profile permissions
   - Must be exactly as defined in system

3. Day Types:
   - Must be boolean values
   - Required for half-day requests

OUTPUT FORMAT:
{
  "leaveType": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "startDayType": boolean,
  "endDayType": boolean,
  // Additional fields based on leave type
}`;

		const prompt = `
${extractionPreamble}

Context:
User Query: ${userMessage}
Current Date (Reference Only): ${dateInfo.currentDate}
Existing Information: ${JSON.stringify(existingData)}

Extract ONLY explicitly mentioned information from the user query following the above rules and format.
Return empty JSON if no explicit parameters found.
Consider user profile permissions when validating leave types.
DO NOT use the current date or make any assumptions about dates. Only extract dates explicitly mentioned by the user.`;

		logger.info('Extractor: Sending chat request');
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
			chatHistory: ctxManager.getConversationHistory(),
		});
		logger.info('Extractor: Received chat response');

		let extractedData = JSON.parse(
			chatResponse.chatResponse.text
				.replace(/`/g, '')
				.replace('json', '')
				.replace(/\\n/g, '')
				.trim()
		);
		logger.info('Extractor: Parsing extracted data');
		logger.info('Extractor: Parsed extracted data', extractedData);

		const existingLeaveType = existingData.leaveType;
		const extractedLeaveType = extractedData.leaveType;

		if (
			existingLeaveType &&
			extractedLeaveType &&
			existingLeaveType !== extractedLeaveType
		) {
			logger.info(
				'Extractor: Leave type changed from',
				existingLeaveType,
				'to',
				extractedLeaveType
			);

			const oldConfig = leaveConfig[existingLeaveType];
			const newConfig = leaveConfig[extractedLeaveType];

			if (oldConfig && newConfig) {
				const oldParams = [
					...oldConfig.mandatoryParams,
					...oldConfig.optionalParams,
				];
				const newParams = [
					...newConfig.mandatoryParams,
					...newConfig.optionalParams,
				];

				// Map common fields
				const commonFields = oldParams.filter((oldParam) =>
					newParams.some((newParam) => newParam.name === oldParam.name)
				);

				commonFields.forEach((field) => {
					if (existingData[field.name] !== undefined) {
						extractedData[field.name] = existingData[field.name];
					}
				});

				// Remove old fields that are not in the new config
				Object.keys(existingData).forEach((key) => {
					if (
						!newParams.some((param) => param.name === key) &&
						key !== 'leaveType'
					) {
						delete existingData[key];
					}
				});
			}

			// Reset paramsPopulated flag
			delete extractedData.paramsPopulated;
		}

		// Modify the merging process
		logger.info('Extractor: Merging data');
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
		logger.info('Extractor: Updating context with merged data');
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
		logger.info('Extractor: Transitioning to next state');
		ctxManager.transition('prompt');
		done();
	},
};

function generateExtractionPreamble(existingData, userProfile) {
	let preamble = `You are an AI assistant for an HRMS Leave Management system. Your task is to extract ONLY explicitly mentioned information from the user's query about a single leave request. Do not make any assumptions or inferences.

	INSTRUCTIONS:
	- WHILE HANDLING DATES CONSIDER ONLY THE WORKING DAYS i.e. MONDAY TO FRIDAY. IF THE USER IS ASKING TO TAKE LEAVE ON A WEEKEND, ADJUST THE DATE TO THE NEAREST WORKING DAY.
	- DO NOT CREATE NEW KEY FIELDS (RESTRICTED TO EXISTING KEYS).
	- HANDLE THE CASES WHERE THE USER MENTIONS THE SAME DATE FOR START AND END DATES.
	- HANDLE THE CASE WHERE THE USER MIGHT BE ASKING FOR HALF DAY LEAVE.
	- IF THE USER IS ASKING TO TAKE HALF DAY LEAVE, CHECK THE START DAY TYPE AND END DAY TYPE PARAMETERS. UPDATE THEM ACCORDINGLY. TRUE FOR FULL DAY, FALSE FOR HALF DAY.
	- CONSIDER THE USER'S PROFILE WHEN EXTRACTING INFORMATION, ESPECIALLY FOR LEAVE TYPES AND DESTINATIONS.
	- USE CAMEL CASE FOR THE KEYS like leaveType, startDate, endDate, etc.

	Extract ONLY the following parameters if EXPLICITLY mentioned:

	1. Leave Type: The type of leave requested (e.g., Annual Leave, Sick Leave, Remote Working).
	2. Start Date: The start date of the leave in YYYY-MM-DD format, ONLY if explicitly stated.
	3. End Date: The end date of the leave in YYYY-MM-DD format, ONLY if explicitly stated.
	4. Start Day Type: Whether the start date is a full day or half day, ONLY if explicitly mentioned.
	5. End Day Type: Whether the end date is a full day or half day, ONLY if explicitly mentioned.

	IF NO PARAMETERS ARE EXPLICITLY MENTIONED, JUST PROVIDE AN EMPTY JSON OBJECT i.e. {}.
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