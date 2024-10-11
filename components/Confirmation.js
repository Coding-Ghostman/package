const { chat } = require('/function/utils/chat');
const ContextManager = require('/function/components/ContextManager');
const moment = require('moment');
const leaveConfig = require('/function/utils/leaveConfig');

module.exports = {
	metadata: {
		name: 'confirmation_v3',
		properties: {},
		supportedActions: ['router', 'cancel'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Confirmation_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();
		logger.info('Confirmation_LLM: Extracted Info:', extractedInfo);
		logger.info('Confirmation_LLM: User Message:', userMessage);

		// Format dates
		const formatDate = (dateString) => {
			const date = moment(dateString);
			return `${date.format('Do MMMM')} (${date.format('dddd')})`;
		};

		const formattedStartDate = formatDate(extractedInfo.startDate);
		const formattedEndDate = formatDate(extractedInfo.endDate);

		// Get mandatory parameters for the leave type
		const leaveTypeConfig = leaveConfig[extractedInfo.leaveType];
		const mandatoryParams = leaveTypeConfig
			? leaveTypeConfig.mandatoryParams
			: [];

		const confirmationPreambleOverride = `
You are an AI assistant for an HRMS Leave Management system. Your task is to generate a confirmation message for the user's leave request and ask for their final approval. Make the message conversational and natural, as if a friendly HR representative is speaking.

Instructions:
1. Summarize only the mandatory leave request details in a conversational manner.
2. Use the provided formatted dates when mentioning start and end dates.
3. Ask the user to confirm if the details are correct.
4. Mention options for the user to confirm, make changes, or cancel the request.
5. Keep the overall tone warm, approachable, and concise.
6. Limit your response to 30 words or less.
7. If the user is trying to modify an existing parameter, acknowledge the change and ask for confirmation.
8. Use a natural, conversational tone similar to: "I've got your ${extractedInfo.leaveType} request from ${formattedStartDate} to ${formattedEndDate}. Does this look good to you?"

`.replace(/\\t/g, '');

		const prompt = `
Extracted Info: ${JSON.stringify(extractedInfo)}
User Message: ${userMessage}
Formatted Start Date: ${formattedStartDate}
Formatted End Date: ${formattedEndDate}
Mandatory Parameters: ${JSON.stringify(mandatoryParams)}

Generate a brief, friendly confirmation message for the leave request based on the extracted information, focusing only on mandatory parameters. Keep it conversational and under 30 words.
`.replace(/\\t/g, '');

		const chatResponse = await chat(prompt, {
			maxTokens: 100,
			temperature: 0.7,
			preambleOverride: confirmationPreambleOverride,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info(
			'Confirmation_LLM: Generated confirmation',
			chatResponse.chatResponse.text
		);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		// Transition based on user's response
		if (
			userMessage.toLowerCase().includes('confirm') ||
			userMessage.toLowerCase().includes('yes')
		) {
			ctxManager.transition('router');
		} else if (
			userMessage.toLowerCase().includes('change') ||
			userMessage.toLowerCase().includes('edit')
		) {
			ctxManager.transition('router');
		} else if (userMessage.toLowerCase().includes('cancel')) {
			ctxManager.transition('cancel');
		} else {
			ctxManager.transition('router');
		}

		ctxManager.addToConversationHistory(
			'CHATBOT',
			chatResponse.chatResponse.text
		);

		done();
	},
};
