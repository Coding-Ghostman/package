const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');
const CalendarTool = require('../utils/calendarTool');
const leaveConfig = require('../utils/leaveConfig');

module.exports = {
	metadata: {
		name: 'prompt_v3',
		properties: {},
		supportedActions: ['router', 'extractor'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Prompt_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();
		const nullExtractedInfo = ctxManager.getNullExtractedInfo();
		const userProfile = ctxManager.getUserProfile();
		const dateInfo = ctxManager.getDateInterpretation();

		logger.info('Prompt_LLM: Extracted Info', extractedInfo);
		logger.info('Prompt_LLM: Null Extracted Info', nullExtractedInfo);
		logger.info('Prompt_LLM: User Message', userMessage);

		let prompt;

		if (Object.keys(extractedInfo).length === 0 || !extractedInfo.leaveType) {
			prompt = `
You are an AI assistant for an HRMS Leave Management system. The user wants to apply for leave, but we don't have any information yet.

Important:
- Ask the user what type of leave they want to apply for.
- Provide a brief list of available leave types (e.g., Annual Leave, Sick Leave, Remote Working).
- Keep the response friendly and concise (under 30 words).

Generate a brief, friendly prompt asking for the leave type.
`;
		} else {
			prompt = `
You are an AI assistant for an HRMS Leave Management system. Your task is to generate appropriate prompts for the user based on the current context of a single leave request process and the user's profile.

Current leave request information:
${JSON.stringify(extractedInfo, null, 2)}

Date Interpretation:
${JSON.stringify(dateInfo, null, 2)}

Important:
- If all mandatory parameters are filled, generate a confirmation message summarizing the leave request details.
- If any mandatory parameters are missing, ask for the missing information one at a time.
- Do not ask for optional parameters.
- Do not assume any information that hasn't been explicitly provided or extracted.
- When mentioning dates, use the format: <day (number)> <month (words)> (<weekday>). For example: "15th May (Monday)".
- Include both start and end dates when mentioning a date range.
- Keep responses under 30 words.
- Consider the user's profile when generating prompts.

Generate a brief, friendly prompt based on the current leave request context.
`;
		}

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.5,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info('Prompt_LLM: Generated prompt', chatResponse.chatResponse.text);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		// Check if all required parameters are filled
		if (extractedInfo.leaveType) {
			const config = leaveConfig[extractedInfo.leaveType];
			if (config) {
				const missingMandatoryParams = config.mandatoryParams.filter(
					(param) =>
						extractedInfo[param.name] === null ||
						extractedInfo[param.name] === undefined
				);
				if (missingMandatoryParams.length === 0) {
					ctxManager.transition('confirmation');
				} else {
					ctxManager.transition('router');
				}
			} else {
				ctxManager.transition('router');
			}
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
