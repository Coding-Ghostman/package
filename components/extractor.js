const { chat } = require('../utils/chat');
const { storeConversationHistory } = require('../utils/conversationHistory');

module.exports = {
	metadata: {
		name: 'extractor',
		properties: {},
		supportedActions: ['router', 'prompt'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		const currentAction = context.variable('currentAction');
		const userMessage = context.getUserMessage();
		console.log('Extractor: Current action', currentAction);
		console.log('Extractor: User message', userMessage);

		let extractedInfo = JSON.parse(context.variable('extractedInfo')) || {};
		const preambleOverride = `You are an AI assistant for an HRMS Leave Management system. Extract the requested information from the user's message. Respond ONLY in the specified JSON format, without any additional text or formatting. JSON format: {"leavePlanType": "extracted type or null", "leaveDates": {"startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null}}`;

		let promptForLLM;
		switch (currentAction) {
			case 'extractLeavePlanType':
				promptForLLM =
					'Extract the leave type (Annual Leave, Sick Leave, or Remote Working leave) from the user\'s message. If not found, return null. Format: {"leavePlanType": "extracted type or null"}';
				break;
			case 'extractLeaveDates':
				promptForLLM =
					'Extract the start and end dates for the leave request. If not found, return null for missing dates. Format: {"startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null"}';
				break;
		}

		try {
			const chatResponse = await chat(userMessage.text, {
				maxTokens: 100,
				temperature: 0,
				topP: 0.1,
				topK: 1,
				preambleOverride,
				promptForLLM,
			});

			console.log(
				'Extractor: Chat response: ',
				chatResponse.chatResponse.text
					.replace(/`/g, '')
					.replace('json', '')
					.replace(/\\n/g, '')
					.trim()
			);

			let extractedData = JSON.parse(
				chatResponse.chatResponse.text
					.replace(/`/g, '')
					.replace('json', '')
					.replace(/\\n/g, '')
					.trim()
			);
			console.log('Extractor: Extracted data', extractedData);

			let isInformationExtracted = false;
			switch (currentAction) {
				case 'extractLeavePlanType':
					if (
						extractedData.leavePlanType &&
						extractedData.leavePlanType !== 'null'
					) {
						extractedInfo['leavePlanType'] = extractedData.leavePlanType;
						isInformationExtracted = true;
					}
					break;
				case 'extractLeaveDates':
					if (
						extractedData.leaveDates &&
						extractedData.leaveDates.startDate !== 'null' &&
						extractedData.leaveDates.endDate !== 'null'
					) {
						extractedInfo['leaveDates'] = extractedData.leaveDates;
						isInformationExtracted = true;
					}
					break;
			}
			console.log(
				'Extractor: Updated extracted info (before stringify)',
				extractedInfo
			);

			context.setVariable('extractedInfo', JSON.stringify(extractedInfo));
			console.log('Extractor: Updated extracted info', extractedInfo);

			if (isInformationExtracted) {
				context.keepTurn(true);
				context.transition('router');
			} else {
				context.keepTurn(true);
				context.transition('prompt');
			}
		} catch (error) {
			logger.error('Extractor: Chat failed with error', error);
			context.keepTurn(true);
			context.transition('prompt');
		}
		done();
	},
};
