const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');
const CalendarTool = require('../utils/calendarTool');
const leaveConfig = require('../utils/leaveConfig');

module.exports = {
	metadata: {
		name: 'prompt_v3',
		properties: {},
		supportedActions: ['router', 'summary'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Prompt_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();
		const dateInfo = ctxManager.getDateInterpretation();

		logger.info('Prompt_LLM: Extracted Info', extractedInfo);
		logger.info('Prompt_LLM: User Message', userMessage);

		const conversationalPreamble = `
Persona: You are Aisha, a friendly HR colleague assisting with leave requests. Communicate naturally and professionally, as if chatting with a work friend.

Guidelines:
- Use a professional yet conversational tone, avoiding bullet points or rigid structures.
- Speak naturally, like a real person rather than an AI or system.
- Ask for mandatory information casually within the conversation flow.
- Use natural date formats (e.g., "next Monday, October 14th").
- For multiple leave dates, ask the user to confirm all dates.
- If Extracted Info shows multiple values for a parameter, clarify which is correct.
- Keep responses concise, around 10 words or less.
- React personally to user messages before proceeding.
- Check Conversation History for context before responding.
- Avoid repeatedly mentioning your name or over-addressing the user.
- For weekend leave requests, suggest the following Monday without assumptions.

USER PROFILE: ${JSON.stringify(ctxManager.getUserProfile())}
`;

		let prompt;
		const userQuery = userMessage; // Assuming userMessage contains the user's query

		if (Object.keys(extractedInfo).length === 0 || !extractedInfo.leaveType) {
			prompt = `
User Query: "${userQuery}"

The user wants to take leave. Casually ask about the type of leave they're considering. Keep it brief and friendly.
`;
		} else {
			const leaveTypeConfig = leaveConfig[extractedInfo.leaveType];
			const missingMandatoryParams = leaveTypeConfig
				? leaveTypeConfig.mandatoryParams.filter(
						(param) => !extractedInfo[param.name]
				  )
				: [];

			const ambiguousParams = Object.entries(extractedInfo).filter(
				([key, value]) => Array.isArray(value) && value.length > 1
			);

			if (ambiguousParams.length > 0) {
				const [ambiguousParam, values] = ambiguousParams[0];
				prompt = `
User Query: "${userQuery}"

There are multiple options for ${ambiguousParam}: ${values.join(
					', '
				)}. Casually ask the user to clarify which one they meant.

Current leave details: ${JSON.stringify(extractedInfo)}
Date info: ${JSON.stringify(dateInfo)}

Remember: only weekdays count for leave. If a weekend is mentioned, suggest the following Monday. Keep your response friendly and concise.
`;
			} else if (missingMandatoryParams.length > 0) {
				const nextParam = missingMandatoryParams[0];
				prompt = `
User Query: "${userQuery}"

We're helping with a ${
					extractedInfo.leaveType
				} request. Casually ask about the ${
					nextParam.name
				}, considering what we know:

Current leave details: ${JSON.stringify(extractedInfo)}
Date info: ${JSON.stringify(dateInfo)}

Remember: only weekdays count for leave. If a weekend is mentioned, suggest the following Monday. Keep it brief and friendly.
`;
			}
		}
		const useLlama = ctxManager.getUseLlama();
		logger.info('Prompt_LLM: prompt Llama', prompt);
		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.5,
			useLlama: useLlama,
			preambleOverride: conversationalPreamble,
			chatHistory: ctxManager.getConversationHistory(),
		});
		const result = useLlama
			? chatResponse.chatResponse.choices[0].message.content[0].text
			: chatResponse.chatResponse.text;
		logger.info('Prompt_LLM: Generated prompt', result);
		ctxManager.setTestResponse(result);
		ctxManager.reply(result);

		if (ctxManager.isLeaveRequestComplete()) {
			ctxManager.transition('confirmation');
		} else {
			ctxManager.transition('router');
		}

		ctxManager.addToConversationHistory('CHATBOT', result);

		done();
	},
};
