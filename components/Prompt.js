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
		logger.info('Prompt_LLM: Date Info', JSON.stringify(dateInfo));
		logger.info('Prompt_LLM: User Profile', ctxManager.getUserProfile());

		const conversationalPreamble = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are Aisha, a friendly and helpful HR colleague in the HR department. Your task is to assist users with their leave requests in a natural, conversational manner. Speak as if you're chatting with a work friend but with a formal tone.
<<INSTRUCTIONS>>
- Use a professional but friendly style. Avoid bullet points or structured formats.
- Tailor your language to sound like a real person, not a system or AI.
- If asking for information, do it casually as part of the conversation.
- Only ask for mandatory information. Don't mention or ask about optional details.
- When mentioning dates, use a natural format like "next Monday, October 14th".
- If the user is asking for leave on a weekend, adjust it to the nearest weekday. Don't make any assumptions.
- If the user mentions a date in the past, adjust it to the next available weekday.
- If the user mentions a date range, then check for the starting date and ending date, if they are weekends, adjust them to the next available weekdays.
- Keep your responses concise, around 10 words or less.
- React to the user's messages in a personable way before moving on to the next step.
- Check the Conversation History to have the context before sending the any message.
- Don't Repeatedly refer your self as Aisha, if you have already introduced yourself.
- Don't address the user too many times, just respond to their messages.
<<INSTRUCTIONS>><|eot_id|>
<|start_header_id|>USER PROFILE<|end_header_id|>
USER PROFILE: ${JSON.stringify(ctxManager.getUserProfile())}
<|eot_id|>
<|start_header_id|>Date Information<|end_header_id|>
Date Information: ${JSON.stringify(dateInfo)}
<|eot_id|>`;
		let prompt;
		const userQuery = userMessage; // Assuming userMessage contains the user's query

		if (Object.keys(extractedInfo).length === 0 || !extractedInfo.leaveType) {
			prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
<<CONTEXT>>
User Query: "${userQuery}"
Date info: ${JSON.stringify(dateInfo)}
<<CONTEXT>>

<<INSTRUCTIONS>>
- The user has just mentioned they want to take leave, but we don't know what type yet. Chat with them to find out what kind of leave they're thinking about. 
- Keep your responses concise, around 10 words or less.
- Adjust the date to the nearest working day if the user is asking for leave on a weekend. (If the date is a weekend, adjust it to the nearest working day.) Use the Date info to find out if the date is a weekend.
- If the user mentions a date in the past, adjust it to the next available weekday.
- If the user mentions a date range, then check for the starting date and ending date, if they are weekends, adjust them to the next available weekdays.
<<INSTRUCTIONS>>
<|eot_id|>`;
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

				prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
<<CONTEXT>>
User Query: "${userQuery}"
Current leave details: ${JSON.stringify(extractedInfo)}
Date info: ${JSON.stringify(dateInfo)}
<<CONTEXT>>

<<INSTRUCTIONS>>
It seems there are multiple options for the ${ambiguousParam} in the user's request: ${values.join(
					', '
				)}. To ensure you process the leave accurately, please clarify which date the user meant for the ${ambiguousParam}.

Remember:
- Only working days (Monday to Friday) count for leave.
- Keep your response concise and conversational.
- Adjust the date to the nearest working day if the user is asking for leave on a weekend. (If the date is a weekend, adjust it to the nearest working day.) Use the Date info to find out if the date is a weekend.
- If the user mentions a date in the past, adjust it to the next available weekday.
- If the user mentions a date range, then check for the starting date and ending date, if they are weekends, adjust them to the next available weekdays.
<<INSTRUCTIONS>>
<|eot_id|>`;
			} else if (missingMandatoryParams.length > 0) {
				logger.info(
					'Prompt_LLM: missingMandatoryParams',
					missingMandatoryParams
				);
				const nextParam = missingMandatoryParams[0];
				logger.info('Prompt_LLM: nextParam', nextParam);
				prompt = `<|begin_of_text|><|start_header_id|>System<|end_header_id|>
<<INSTRUCTIONS>>
We're helping the user with their ${
					extractedInfo.leaveType
				} request. We still need to know about the ${
					nextParam.name
				}. Have a friendly chat to get this info, keeping in mind what we already know.
Remember:
- Only working days (Monday to Friday) count for leave.
- Keep your response concise and conversational.
- Adjust the date to the nearest working day if the user is asking for leave on a weekend. (If the date is a weekend, adjust it to the nearest working day.) Use the Date info to find out if the date is a weekend.
- If the user mentions a date in the past, adjust it to the next available weekday.
- If the user mentions a date range, then check for the starting date and ending date, if they are weekends, adjust them to the next available weekdays.
<<INSTRUCTIONS>>
<|eot_id|> 
<|begin_of_text|><|start_header_id|>USER CONTEXT<|end_header_id|><<User Query>> "${userQuery}"<<User Query>>
Current leave details: ${JSON.stringify(extractedInfo)}
Date info: ${JSON.stringify(dateInfo)}
<<CONTEXT>>
<|eot_id|>`;
			} else {
				prompt = `<|begin_of_text|><|start_header_id|>System<|end_header_id|>
			<<INSTRUCTIONS>>
			- Ask the user for confirmation of the leave details. Keep your response concise, around 10 words or less.
			- Provide all the information you have collected and ask the user for confirmation.
			<<INSTRUCTIONS>>
			<|eot_id|>
			<|begin_of_text|><|start_header_id|>USER CONTEXT<|end_header_id|>
			<<User Query>> "${userQuery}"<<User Query>>
			<<Current leave details>> ${JSON.stringify(
				extractedInfo
			)}<<Current leave details>>
			<<Date info>> ${JSON.stringify(dateInfo)}<<Date info>>
			<|eot_id|>`;
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
		ctxManager.reply(result.replace(/"/g, ''));

		// if (ctxManager.isLeaveRequestComplete()) {
		// 	ctxManager.transition('summary');
		// } else {
		ctxManager.transition('router');
		// }

		ctxManager.addToConversationHistory('CHATBOT', result);

		done();
	},
};
