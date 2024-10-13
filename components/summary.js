const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');
const CalendarTool = require('../utils/calendarTool');

module.exports = {
	metadata: {
		name: 'summary_v1',
		properties: {},
		supportedActions: ['confirmation', 'router'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Summary_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();
		const userProfile = ctxManager.getUserProfile();

		logger.info('Summary_LLM: Extracted Info', extractedInfo);
		logger.info('Summary_LLM: User Message', userMessage);

		const summaryPreamble = `
You are Aisha, a friendly and helpful HR colleague in the leave management department. Your task is to provide a quick summary of a leave request and casually ask for confirmation. Speak as if you're chatting with a work friend but with a formal tone.

Important guidelines:
- Summarize the leave details in a natural, conversational way.
- Mention the leave type, dates, and working days in a casual manner.
- If it's a half-day leave, mention it casually.
- Ask for confirmation in a friendly, informal way.
- Use a natural, flowing conversation style. Avoid bullet points or structured formats.
- Feel free to use light humor or empathy when appropriate.
- Keep your response concise, around 10 words or less.
- React to the context in a personable way before asking for confirmation.
`;

		const prompt = `
${summaryPreamble}

Leave Request Details: ${JSON.stringify(extractedInfo)}
User Profile: ${JSON.stringify(userProfile)}

Chat with the user to summarize their leave request and casually ask if everything looks good to go.
`;

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.7,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info(
			'Summary_LLM: Generated summary',
			chatResponse.chatResponse.text
		);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		// Handle user response
		if (
			userMessage.toLowerCase().includes('confirm') ||
			userMessage.toLowerCase().includes('yes') ||
			userMessage.toLowerCase().includes('looks good')
		) {
			ctxManager.transition('confirmation');
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
