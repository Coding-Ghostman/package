const { chat } = require('../utils/chat');

module.exports = {
	metadata: {
		name: 'prompt_v2',
		properties: {},
		supportedActions: ['router', 'extractor'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Prompt_LLM: Invoking');

		// Use default empty objects if variables are undefined
		const nullExtractedInfo = JSON.parse(
			context.variable('nullExtractedInfo') || '{}'
		);
		const extractedInfo = JSON.parse(
			context.variable('user.extractedInfo') || '{}'
		);
		const currentAction = context.variable('currentAction');

		const extractionPreambleOverride = `
You are an AI assistant for an HRMS Leave Management system. Your task is to prompt the user for missing information or confirm leave details based on the given parameters and extracted information.

Instructions:
1. Analyze the extracted information for all necessary parameters: leave type, start date, end date, start day type, and end day type.
2. If any information is missing, ask for it in a conversational manner, focusing on one parameter at a time.
3. If all necessary parameters are extracted, create a confirmation prompt.
4. If the user query is not related to leave requests, politely redirect them to provide the required information.
5. Keep responses concise and user-friendly.
6. Do not ask about start day type or end day type unless the user has explicitly mentioned it.

Scenarios:
A. Missing Information:
   - Ask for the missing parameter in a natural, conversational way.
   - Provide context based on the information already extracted.

B. Confirmation:
   - If all information is available, ask the user to confirm the leave details.
   - Present the extracted information in a clear, easy-to-read format.
   - Include start day type and end day type in the confirmation only if they were explicitly mentioned by the user.

C. Out of Context:
   - If the user's query is unrelated to leave requests, gently guide them back to the leave request process.

D. Sequential Order:
   - If multiple parameters are missing, ask for them in this order: leave type, start date, end date.
   - Only ask about start day type or end day type if the user has mentioned it previously.

Always maintain a helpful and friendly tone.
`.replace(/\\t/g, '');

		const prompt = `
You are an intelligent prompt creator for a leave management system. Create a response based on the following guidelines:

1. Analyze the user query and extracted information.
2. If information is missing, ask for it one parameter at a time, in order: leave type, start date, end date.
3. If all information is present, create a confirmation prompt.
4. Keep responses concise and conversational.
5. If the query is unrelated to leave requests, gently redirect the user.
6. Only mention start day type or end day type if the user has explicitly brought it up.

User Query: ${context.getUserMessage().text}
Extracted Info: ${JSON.stringify(extractedInfo)}
Missing Info: ${JSON.stringify(nullExtractedInfo)}

Respond with an appropriate prompt or confirmation message.
`.replace(/\\t/g, '');

		const chatResponse = await chat(prompt, {
			maxTokens: 600,
			temperature: 0,
			docs: [
				{
					title: 'Sick',
					text: 'Used if the employee is unable to attend work due to a medical reason, such as they are ill, or have to attend a medical appointment',
				},
				{
					title: 'Annual',
					text: 'The employee is entitled to take 20 days annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work.  This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
				},
				{
					title: 'Remote',
					text: 'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
				},
			],
			preambleOverride: extractionPreambleOverride,
		});

		console.log('Prompt_LLM: Chat response', chatResponse.chatResponse.text);
		context.setVariable('testResponse', chatResponse.chatResponse.text);
		context.reply(chatResponse.chatResponse.text);
		context.transition('router');
		done();
	},
};
