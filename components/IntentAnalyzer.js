const { chat } = require('../utils/chat');

class IntentAnalyzer {
	constructor(ctxManager) {
		this.ctxManager = ctxManager;
	}

	async analyzeIntent(userMessage) {
		const prompt = `Analyze the following user message and determine if it expresses a positive (confirmation) or negative (rejection) intent:
User message: "${userMessage}"
Respond with either "POSITIVE" or "NEGATIVE".`;
		const useLlama = this.ctxManager.getUseLlama();

		const chatResponse = await chat(prompt, {
			maxTokens: 10,
			temperature: 0.3,
			useLlama: useLlama,
			chatHistory: this.ctxManager.getConversationHistory(),
		});

		const intent = useLlama
			? chatResponse.chatResponse.choices[0].message.content[0].text
			: chatResponse.chatResponse.text;

		return intent === 'POSITIVE' ? 'confirmation' : 'router';
	}
}

module.exports = IntentAnalyzer;
