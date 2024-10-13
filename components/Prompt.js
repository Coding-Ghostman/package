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
You are Aisha, a friendly and helpful HR colleague in the HR department. Your task is to assist users with their leave requests in a natural, conversational manner. Speak as if you're chatting with a work friend but with a formal tone.

Important guidelines:
- Use a natural, flowing conversation style. Avoid bullet points or structured formats.
- Tailor your language to sound like a real person, not a system or AI.
- If asking for information, do it casually as part of the conversation.
- Only ask for mandatory information. Don't mention or ask about optional details.
- When mentioning dates, use a natural format like "next Monday, October 14th".
- Keep your responses concise, around 10 words or less.
- React to the user's messages in a personable way before moving on to the next step.
- Check the Conversation History to have the context before sending the any message.
- Don't Repeatedly refer your self as Aisha, if you have already introduced yourself.
`;

		let prompt;

		if (Object.keys(extractedInfo).length === 0 || !extractedInfo.leaveType) {
			prompt = `
${conversationalPreamble}

The user has just mentioned they want to take leave, but we don't know what type yet. Chat with them to find out what kind of leave they're thinking about. Keep your responses concise, around 10 words or less..
`;
		} else {
			const leaveTypeConfig = leaveConfig[extractedInfo.leaveType];
			const missingMandatoryParams = leaveTypeConfig
				? leaveTypeConfig.mandatoryParams.filter(
						(param) => !extractedInfo[param.name]
				  )
				: [];

			if (missingMandatoryParams.length === 0) {
				prompt = `
${conversationalPreamble}

Great news! We've got all the details we need for ${
					extractedInfo.leaveType
				}. Chat with the user about reviewing the info before we wrap things up. Make it sound casual and friendly.

Current leave details: ${JSON.stringify(extractedInfo)}
`;
			} else {
				const nextParam = missingMandatoryParams[0];
				prompt = `
${conversationalPreamble}

We're helping the user with their ${
					extractedInfo.leaveType
				} request. We still need to know about the ${
					nextParam.name
				}. Have a friendly chat to get this info, keeping in mind what we already know:

Current leave details: ${JSON.stringify(extractedInfo)}
Date info: ${JSON.stringify(dateInfo)}

Remember, only working days (Monday to Friday) count for leave.
`;
			}
		}

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.7,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info('Prompt_LLM: Generated prompt', chatResponse.chatResponse.text);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		if (ctxManager.isLeaveRequestComplete()) {
			ctxManager.transition('summary');
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
