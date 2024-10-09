const { chat } = require('../utils/chat');
const { storeConversationHistory } = require('../utils/conversationHistory');

module.exports = {
	metadata: {
		name: 'prompting',
		properties: {},
		supportedActions: ['router', 'extractor'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		const extractedInfo = JSON.parse(context.variable('extractedInfo')) || {};
		const currentAction = context.variable('currentAction');
		console.log('Prompting: Current action', currentAction);
		console.log('Prompting: Extracted info', extractedInfo);

		const preambleOverride = `You are an AI assistant for an HRMS Leave Management system. Generate a concise prompt to ask the user for specific information.`;

		let promptForLLM;
		switch (currentAction) {
			case 'extractLeavePlanType':
				promptForLLM =
					'Generate a prompt asking for the leave type (Annual Leave, Sick Leave, or Remote Working leave).';
				break;
			case 'extractLeaveDates':
				promptForLLM =
					'Generate a prompt asking for the start and end dates of the leave request.';
				break;
			case 'extractOptionalFields':
				if (extractedInfo.leavePlanType === 'Annual Leave') {
					promptForLLM =
						'Generate a prompt asking if the user wants to provide optional information like leave destination (local/abroad) or advance leave salary request (yes/no).';
				} else if (extractedInfo.leavePlanType === 'Sick Leave') {
					promptForLLM =
						'Generate a prompt asking if the user has a medical certificate to attach to the sick leave request.';
				} else {
					promptForLLM =
						"Generate a prompt asking if there's any additional information the user would like to provide for their leave request.";
				}
				break;
			default:
				promptForLLM =
					'Generate a prompt asking for more information about the leave request.';
		}

		try {
			const chatResponse = await chat(promptForLLM, {
				maxTokens: 50,
				temperature: 0.7,
				topP: 0.9,
				topK: 3,
				preambleOverride,
			});

			let promptMessage = chatResponse.chatResponse.text
				.replace(/`/g, '')
				.replace('json', '')
				.trim();
			storeConversationHistory(context, 'CHATBOT', promptMessage);
			context.reply(promptMessage);
			console.log('Prompting: Sent prompt message to user', promptMessage);

			context.transition('extractor');
		} catch (error) {
			logger.error('Prompting: Chat failed with error', error);
			let errorMessage =
				"I'm sorry, I'm having trouble generating a response. Could you please provide more information about your leave request?";
			context.reply(errorMessage);
			storeConversationHistory(context, 'CHATBOT', errorMessage);
			context.transition('extractor');
		}
		done();
	},
};
