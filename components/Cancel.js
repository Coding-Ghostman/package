const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');

module.exports = {
	metadata: {
		name: 'cancel_v3',
		properties: {},
		supportedActions: ['router'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Cancel_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();

		const cancelPreamble = `
You are an AI assistant for an HRMS Leave Management system. Your task is to handle the cancellation of a leave request or the current leave application process.

Instructions:
1. Confirm the user's intention to cancel.
2. If cancelling an ongoing application, summarize what will be discarded.
3. If cancelling a submitted request, explain the cancellation process.
4. Provide a brief, friendly response acknowledging the cancellation.
5. Keep the response under 40 words.
6. Use a conversational tone, as if a friendly HR representative is speaking.
`;

		const prompt = `
User Message: ${userMessage}
Extracted Info: ${JSON.stringify(extractedInfo)}

Generate a brief, friendly response handling the cancellation of the leave request or application process.
`;
		const useLlama = ctxManager.getUseLlama();
		const chatResponse = await chat(prompt, {
			maxTokens: 150,
			temperature: 0.7,
			preambleOverride: cancelPreamble,
			chatHistory: ctxManager.getConversationHistory(),
			useLlama: useLlama,
		});
		const result = useLlama
			? chatResponse.chatResponse.choices[0].message.content[0].text
			: chatResponse.chatResponse.text;

		logger.info(
			'Cancel_LLM: Generated response', result);
		ctxManager.setTestResponse(result);
		ctxManager.reply(result);

		// Clear extracted info and conversation history
		ctxManager.setExtractedInfo({});
		ctxManager.setNullExtractedInfo({});
		ctxManager.clearConversationHistory();

		// Transition back to the router
		ctxManager.transition('router');

		done();
	},
};
