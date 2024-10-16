const { chat } = require('../utils/chat');
const ContextManager = require('../components/ContextManager');

module.exports = {
	metadata: {
		name: 'cancel_v2',
		properties: {},
		supportedActions: ['router'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Cancel_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();

		const cancelPreambleOverride = `
You are an AI assistant for an HRMS Leave Management system. Your task is to ask for confirmation before cancelling a leave request. Be concise and professional.

Instructions:
1. Ask the user to confirm if they want to cancel their leave request.
2. Do not assume or mention any specific leave types or details.
3. Do not process the cancellation yet.
4. Keep the response under 30 words.
5. Only ask for confirmation, do not provide any other information or options.
`.replace(/\\t/g, '');

		const prompt = `
User Message: ${userMessage}

Generate a response asking for confirmation to cancel the leave request.
`.replace(/\\t/g, '');

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.7,
			preambleOverride: cancelPreambleOverride,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info(
			'Cancel_LLM: Generated response',
			chatResponse.chatResponse.text
		);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		ctxManager.setExtractedInfo({});
		ctxManager.setNullExtractedInfo({});

		// Clear the conversation history
		ctxManager.clearConversationHistory();

		// Always transition back to the router after cancellation
		ctxManager.transition('router');

		// ctxManager.addToConversationHistory(
		// 	'CHATBOT',
		// 	chatResponse.chatResponse.text
		// );

		done();
	},
};
