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

		const extractionPreambleOverride =
			`You are an AI assistant for an HRMS Leave Management system. Your task is to prompt the user, about the missing information based on the given parameters and the extracted information:
    
    Instructions:
    1. Analyze the extracted information for all the necessary parameters.
    2. Consider the following parameters: leave type, start date, end date.
    3. Prompt the user about the missing information based on the extracted information.
    4. If all the necessary parameters are extracted, respond with "No".
    5. If the user query is not related to leave request, ask the user to provide the required information without overwhelming them.
    6.If you receive a no Missing Info and all the fields in the extracted Info is full:
      Create a prompt for the user asking only for the confirmation of the leave Details and provide the extracted information in a conversational manner. In the confirmation prompt, ask the user if they want to confirm the leave details and don't ask any other information.
    `.replace(/\\t/g, '');

		const prompt = `
    - You are an intelligent prompt creator for the user Asking the user to provide the required information.
    - Don't ask for the same information again.
    - Don't ask for the information that has already been provided.
    - The Question should be as short as possible, Do not overwhelm the user with too many questions.
    - If you receive a no Missing Info and all the fields in the extracted Info is full: Create a prompt for the user asking only for the confirmation of the leave Details and provide the extracted information in a conversational manner.

    User Query: ${context.getUserMessage().text}
    Extracted Info: ${JSON.stringify(extractedInfo)}
    Missing Info: ${JSON.stringify(nullExtractedInfo)}`.replace(/\\t/g, '');

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
