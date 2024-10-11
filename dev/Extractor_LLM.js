const { chat } = require('../utils/chat');
const ContextManager = require('../components/ContextManager');
const CalendarTool = require('../utils/calendarTool');

module.exports = {
	metadata: {
		name: 'extractor_v2',
		properties: {},
		supportedActions: ['router', 'prompt'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Extractor: Invoked');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const calendarTool = new CalendarTool();
		const dateInfo = calendarTool.interpretDateQuery(userMessage);
		logger.info('Extractor: Date interpretation', dateInfo);
		const existingData = ctxManager.getExtractedInfo();
		logger.info('Extractor: Existing data', existingData);
		logger.info('Extractor: User Message', userMessage);

		const extractionPreambleOverride = `You are an AI assistant for an HRMS Leave Management system. Your task is to extract ONLY explicitly mentioned information from the user's query about a single leave request. Do not make any assumptions or inferences.

		Extract ONLY the following parameters if EXPLICITLY mentioned:

		1. Leave Type: The type of leave requested (e.g., Annual Leave, Sick Leave, Remote Working).
		2. Start Date: The start date of the leave in YYYY-MM-DD format, ONLY if explicitly stated.
		3. End Date: The end date of the leave in YYYY-MM-DD format, ONLY if explicitly stated.
		4. Start Day Type: Whether the start date is a full day or half day, ONLY if explicitly mentioned.
		5. End Day Type: Whether the end date is a full day or half day, ONLY if explicitly mentioned.

		Respond with the extracted information in JSON format. Include ONLY the fields that are explicitly mentioned in the user's query. Do not include any assumed or inferred information. Use CamelCase for the keys.

		IMPORTANT: Do NOT assume or infer any dates or information. Only extract what is explicitly stated in the user's message.`;

		const prompt = `User Query: ${userMessage}
		Date Interpretation: ${JSON.stringify(dateInfo)}
		Existing Information: ${JSON.stringify(existingData)}

		Extract ONLY the explicitly mentioned leave request information based on the given instructions. Do NOT include any information that is not explicitly stated in the user's query.`;

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
					text: 'The employee is entitled to take 20 days annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work. This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
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
		const cleanedData = removeAssumedDates(extractedData, userMessage);
		logger.info('Extractor: Cleaned extracted data', cleanedData);

		// Merge the new extracted data with existing data
		const mergedData = { ...existingData, ...cleanedData };
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
		const nullInfo = Object.keys(mergedData).reduce((acc, key) => {
			acc[key] = mergedData[key] === null;
			return acc;
		}, {});
		logger.info('Extractor: Null info', nullInfo);
		ctxManager.setNullExtractedInfo(nullInfo);

		ctxManager.keepTurn(true);
		ctxManager.transition('router');

		ctxManager.addToConversationHistory('SYSTEM', 'Information extracted');

		done();
	},
};

function removeAssumedDates(extractedData, userMessage) {
	const dateFields = ['startDate', 'endDate'];
	const cleanedData = { ...extractedData };

	dateFields.forEach((field) => {
		if (cleanedData[field] && !userMessage.includes(cleanedData[field])) {
			delete cleanedData[field];
		}
	});

	return cleanedData;
}
