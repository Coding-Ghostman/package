const { chat } = require('../utils/chat');
const conversationHistory = require('../utils/conversationHistory');

module.exports = {
	metadata: {
		name: 'router',
		properties: {},
		supportedActions: [],
	},
	invoke: async (context, done) => {
		// const authenticationProvider = await new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build();

		const logger = context.logger();
		let History = context.variable('user.conversationHistory');

		if (History === null || History === undefined) {
			conversationHistory.storeConversationHistory(
				context,
				'SYSTEM',
				`You are an intelligent routing agent for a deterministic agent-based system. Your role is to analyze user queries and route them to the appropriate specialized agent. You have two main routing options:

				1. Information Extractor Agent: Route here if the user's query requires extracting specific information about time off work, such as leave types, policies, or procedures.

				2. Validation Agent: Route here if the query involves validating or confirming previously extracted information, or if the user is submitting a leave request that needs verification.

				3. Reprompt Agent: Route here if the user's query is not clear or if the user needs to be prompted for more information.

				For each user query, you must:
				1. Analyze the intent and content of the message.
				2. Determine which specialized agent is best suited to handle the query.
				3. Provide your routing decision with a single word: "extractor" or "validator" or "reprompt"

				Always maintain a neutral, professional tone and focus solely on routing. Do not attempt to answer queries directly.`.replace(
					/\t/g,
					''
				)
			);
		}

		const userMessage = context.getUserMessage();
		const preambleOverride = `You are an intelligent routing agent designed to assist employees in managing their time off work. Your role is to analyze user queries and determine the most appropriate specialized agent to handle each request.`;
		const docs = [];

		conversationHistory.storeConversationHistory(
			context,
			'USER',
			userMessage.text
		);

		try {
			const chatResponse = await chat(userMessage.text, {
				chatHistory: context.variable('user.conversationHistory'),
				docs,
				maxTokens: 20,
				temperature: 0,
				topP: 0.1,
				topK: 1,
				preambleOverride,
			});

			console.log(JSON.stringify(chatResponse) + '\n');
			let response = chatResponse.chatResponse.text
				.replace(/`/g, '')
				.replace('json', '')
				.trim();

			// console.log(response);
			context.reply(response);
		} catch (error) {
			logger.error('chat Failed with error  ' + error);
		}
		context.transition();
		done();
	},
};
