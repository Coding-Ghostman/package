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
- Use a professional but friendly style. Avoid bullet points or structured formats.
- Tailor your language to sound like a real person, not a system or AI.
- If asking for information, do it casually as part of the conversation.
- Only ask for mandatory information. Don't mention or ask about optional details.
- When mentioning dates, use a natural format like "next Monday, October 14th".
- If an array of leaves is mentioned, handle it gracefully. Ask the user to confirm the dates for all the leaves.
- Check the Extracted Info, if you find that for a parameter, multiple values are mentioned in an array, that is an ambiguity. Ask the user for that parameter which is right and which is wrong.
- Keep your responses concise, around 10 words or less.
- React to the user's messages in a personable way before moving on to the next step.
- Check the Conversation History to have the context before sending the any message.
- Don't Repeatedly refer your self as Aisha, if you have already introduced yourself.
- Don't address the user too many times, just respond to their messages.

USER PROFILE: ${JSON.stringify(ctxManager.getUserProfile())}
`;

		let prompt;
		const userQuery = userMessage; // Assuming userMessage contains the user's query

		if (Object.keys(extractedInfo).length === 0 || !extractedInfo.leaveType) {
			prompt = `
User Query: "${userQuery}"

The user has just mentioned they want to take leave, but we don't know what type yet. Chat with them to find out what kind of leave they're thinking about. Keep your responses concise, around 10 words or less.
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
 
It seems there are multiple options for the ${ambiguousParam} in your request: ${values.join(
					', '
				)}. To ensure I process your leave accurately, could you please clarify which date you meant for the ${ambiguousParam}?
 
Current leave details: ${JSON.stringify(extractedInfo)}

Date info: ${JSON.stringify(dateInfo)}
 
Just a reminder: only working days (Monday to Friday) count for leave.

`;
			} else if (missingMandatoryParams.length === 0) {
				prompt = `
User Query: "${userQuery}"

Great news! We've got all the details we need for ${
					extractedInfo.leaveType
				}. Chat with the user about reviewing the info before we wrap things up. Make it sound casual and friendly.

Current leave details: ${JSON.stringify(extractedInfo)}
Date info: ${JSON.stringify(dateInfo)}
`;
			} else {
				const nextParam = missingMandatoryParams[0];
				prompt = `
User Query: "${userQuery}"

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
