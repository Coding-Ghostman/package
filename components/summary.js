const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');
const IntentAnalyzer = require('./IntentAnalyzer');

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
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are Aisha, a friendly and helpful HR colleague in the leave management department. Your task is to provide a quick summary of a leave request and casually ask for confirmation. Speak as if you're chatting with a work friend but with a formal tone. Don't refer user so many times, just provide the response.

Important guidelines:
- Summarize the leave details in a natural, conversational way.
- Mention the leave type, dates, and working days in a casual manner.
- If it's a half-day leave, mention it casually.
- Ask for confirmation in a friendly, informal way.
- Use a natural, flowing conversation style. Avoid bullet points or structured formats.
- Feel free to use light humor or empathy when appropriate.
- Keep your response concise, around 10 words or less.
- React to the context in a personable way before asking for confirmation.
- Don't add any formatting like JSON or code blocks or double quotes.
<|eot_id|>`;

		const prompt = `<|begin_of_text|><|start_header_id|>user<|end_header_id|>
Leave Request Details: ${JSON.stringify(extractedInfo)}
User Profile: ${JSON.stringify(userProfile)}
<|eot_id|>
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
Chat with the user to summarize their leave request and casually ask if everything looks good to go.
<|eot_id|>`;
		const useLlama = true;
		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.7,
			preambleOverride: summaryPreamble,
			chatHistory: ctxManager.getConversationHistory(),
			useLlama: useLlama,
		});
		const result = useLlama
			? chatResponse.chatResponse.choices[0].message.content[0].text
			: chatResponse.chatResponse.text;

		logger.info('Summary_LLM: Generated summary', result);
		ctxManager.setTestResponse(result);
		ctxManager.reply(result.replace(/"/g, ''));

		// Replace the hard-coded user response handling with IntentAnalyzer
		const intentAnalyzer = new IntentAnalyzer(ctxManager);
		const nextTransition = await intentAnalyzer.analyzeIntent(userMessage);
		ctxManager.transition(nextTransition);

		ctxManager.addToConversationHistory('CHATBOT', result);

		done();
	},
};
