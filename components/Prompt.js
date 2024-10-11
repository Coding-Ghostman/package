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
		const userProfile = ctxManager.getUserProfile();
		const calendarTool = new CalendarTool();
		const dateInfo = calendarTool.interpretDateQuery(userMessage);

		logger.info('Prompt_LLM: Extracted Info', extractedInfo);
		logger.info('Prompt_LLM: User Message', userMessage);

		const promptPreambleOverride = `
You are an AI assistant for an HRMS Leave Management system. Your task is to generate appropriate prompts for the user based on the current context of a single leave request process and the user's profile.

Important:
- Focus only on obtaining missing mandatory parameters for the specified leave type or requesting confirmation.
- If all mandatory parameters are filled, ask for confirmation.
- Generate a conversational prompt to ask for missing information, focusing on one parameter at a time.
- Do not ask for optional parameters.
- Do not assume any information that hasn't been explicitly provided or extracted.
- When mentioning dates, use the format: <day (number)> <month (words)> (<weekday>). For example: "15th May (Monday)".
- Include both start and end dates when mentioning a date range.
- Keep responses under 20 words.
- Consider the user's profile if it is relevant to the context when generating prompts.

Remember: Never imply or assume a leave type or any other information that isn't in the extracted info or user profile.
`.replace(/\\t/g, '');

		const leaveTypeConfig = extractedInfo.leaveType
			? leaveConfig[extractedInfo.leaveType]
			: null;

		const missingMandatoryParams = [];
		if (leaveTypeConfig) {
			leaveTypeConfig.mandatoryParams.forEach((param) => {
				if (
					extractedInfo[param.name] === null ||
					extractedInfo[param.name] === undefined
				) {
					missingMandatoryParams.push(param);
				}
			});
		}

		const prompt = `
${promptPreambleOverride}

User Query: ${userMessage}
Extracted Info: ${JSON.stringify(extractedInfo)}
Missing Mandatory Params: ${JSON.stringify(missingMandatoryParams)}
Leave Type Config: ${JSON.stringify(leaveTypeConfig)}
User Profile: ${JSON.stringify(userProfile)}

Generate a brief, friendly prompt based on the current leave request context and user profile. If there are missing mandatory parameters, ask for one of them. If all mandatory parameters are filled, ask for confirmation. Keep it short and conversational. Do not assume any information not present in the extracted info or user profile.
`.replace(/\\t/g, '');

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.5,
			preambleOverride: promptPreambleOverride,
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
