const { chat } = require('../utils/chat');
const ContextManager = require('../components/ContextManager');
const CalendarTool = require('../utils/calendarTool');
const leaveConfig = require('../utils/leaveConfig');

module.exports = {
	metadata: {
		name: 'prompt_v2',
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

		const calendarTool = new CalendarTool();
		const dateInfo = calendarTool.interpretDateQuery(userMessage);

		logger.info('Prompt_LLM: Extracted Info', extractedInfo);
		logger.info('Prompt_LLM: Null Extracted Info', nullExtractedInfo);
		logger.info('Prompt_LLM: User Message', userMessage);

		const promptPreambleOverride = `
You are an AI assistant for an HRMS Leave Management system. Your task is to generate appropriate prompts for the user based on the current context of a single leave request process.

Important:
- Analyze the extracted information and identify missing or potentially updated parameters.
- If the leave type is not specified, ask for it first before other details.
- Once the leave type is specified, focus on obtaining the mandatory parameters for that leave type.
- Generate a conversational prompt to ask for missing information or confirm changes, focusing on one parameter at a time.
- Do not assume any information that hasn't been explicitly provided or extracted.
- When mentioning dates, use the format: <day (number)> <month (words)> (<weekday>). For example: "15th May (Monday)".
- Include both start and end dates when mentioning a date range.
- Handle one leave request at a time.
- Keep responses under 20 words.
- Avoid using phrases like "Confirm, tweak, or nix".

Remember: Never imply or assume a leave type or any other information that isn't in the extracted info.
`.replace(/\\t/g, '');

		const leaveTypeConfig = extractedInfo.leaveType
			? leaveConfig[extractedInfo.leaveType.toLowerCase()]
			: null;

		const prompt = `
User Query: ${userMessage}
Extracted Info: ${JSON.stringify(extractedInfo)}
Missing Info: ${JSON.stringify(nullExtractedInfo)}
Leave Type Config: ${JSON.stringify(leaveTypeConfig)}

Generate a brief, friendly prompt based on the current leave request context, keeping in mind the conversation history. Focus on obtaining missing mandatory parameters for the specified leave type. Keep it short and conversational. Do not assume any information not present in the extracted info. Include both start and end dates when mentioning a date range.
`.replace(/\\t/g, '');

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.5,
			docs: [
				{
					title: 'Sick',
					text: 'Used for medical reasons or appointments',
				},
				{
					title: 'Annual',
					text: 'This leave employees can take at their discretion without giving a particular reason. The purpose is simply to give them a break from work. This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
				},
				{
					title: 'Remote',
					text: 'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
				},
			],
			preambleOverride: promptPreambleOverride,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info('Prompt_LLM: Generated prompt', chatResponse.chatResponse.text);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		// Check if all required parameters are filled
		if (extractedInfo.leaveType) {
			const config = leaveConfig[extractedInfo.leaveType.toLowerCase()];
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
