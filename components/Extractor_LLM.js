const { chat } = require('../utils/chat');

module.exports = {
	metadata: {
		name: 'extractor_v2',
		properties: {},
		supportedActions: ['router', 'prompt'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Extractor: Invoked');
		const userMessage = context.getUserMessage();
		console.log('Extractor: User message', userMessage);
		const extractionPreambleOverride = `You are an AI assistant for an HRMS Leave Management system. Your task is to extract specific information from the user's query about leave requests. Analyze the user's message and extract ONLY the following parameters if present:

1. Leave Type: The type of leave requested (e.g., Annual Leave, Sick Leave, Remote Working).
2. Start Date: The start date of the leave in YYYY-MM-DD format.
3. End Date: The end date of the leave in YYYY-MM-DD format.

Respond ONLY with the extracted information in this format:
{
  "leaveType": "extracted type or null",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null"
}

- If a parameter is not found in the user's message, use null for its value. Do not include any explanations or additional text in your response.
- Start and End date are related to the leave dates i.e., the start and end dates. If Only one date is provided, consider it that both the start and end date are the same.
- If multiple values can be discern for any of the parameters, provide it in an array.
- If Multiple dates are found, use the first date as the start date and the second date as the end date.
- If only one date is found, use it as both the start and end date.
- If the user's message does not contain any date information, return null for both start and end dates.

`;
		const prompt = `User Query: ${userMessage.text}

		Based on the user query, extract the below possible parameters:
		- Leave Type: The type of leave that the user is requesting for.
		- Start Date: The start date of the leave that the user is requesting for.
		- End Date: The end date of the leave that the user is requesting for.

		Respond ONLY with the extracted information in this format:
    {
      "leaveType": "extracted type or null",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null"
    }
		`.replace(/\\t/g, '');
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
					text: 'The employee is entitled to take 20 days annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work.  This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
				},
				{
					title: 'Remote',
					text: 'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
				},
			],
			preambleOverride: extractionPreambleOverride,
		});
		console.log('Extractor: Chat response', chatResponse.chatResponse.text);
		let extractedData = JSON.parse(
			chatResponse.chatResponse.text
				.replace(/`/g, '')
				.replace('json', '')
				.replace(/\\n/g, '')
				.trim()
		);
		console.log('Extractor: Extracted data', extractedData);

		// Separate valid and null data from updatedData
		let extractedValidData = {};
		let extractedNullData = {};
		for (const [key, value] of Object.entries(extractedData)) {
			if (value !== null) {
				extractedValidData[key] = value;
			} else {
				extractedNullData[key] = null;
			}
		}

		let existingData = JSON.parse(
			context.variable('user.extractedInfo') || '{}'
		);
		existingData = { ...existingData, ...extractedValidData };
		context.setVariable('user.extractedInfo', JSON.stringify(existingData));

		extractedValidData = {};
		extractedNullData = {};

		// Get all unique keys from both existingData and extractedData
		const allKeys = new Set([
			...Object.keys(existingData),
			...Object.keys(extractedData),
		]);

		for (const key of allKeys) {
			if (existingData[key] !== null && existingData[key] !== undefined) {
				extractedValidData[key] = existingData[key];
			} else if (
				extractedData[key] === null ||
				extractedData[key] === undefined
			) {
				extractedNullData[key] = null;
			}
		}
		console.log('Extractor: Existing data', existingData);
		console.log('Extractor: Extracted data', extractedData);
		console.log('Extractor: Valid data', extractedValidData);
		console.log('Extractor: Null data', extractedNullData);
		context.setVariable(
			'validExtractedInfo',
			JSON.stringify(extractedValidData)
		);
		context.setVariable('nullExtractedInfo', JSON.stringify(extractedNullData));
		// if (Object.keys(extractedNullData).length > 0) {
		context.keepTurn(true);
		context.transition('prompt');
		// } else {
		// 	context.keepTurn(true);
		// 	context.transition('router');
		// }

		done();
	},
};
