const { chat } = require('../utils/chat');

module.exports = {
	metadata: {
		name: 'router_v2',
		properties: {},
		supportedActions: ['extraction', 'prompt'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Router: Invoked');
		const currentAction = context.variable('lastAction') || 'initial';
		const extractedInfo = context.variable('user.extractedInfo') || {};

		const userMessage = context.getUserMessage();
		logger.info('Router: Extracted info', extractedInfo);
		const routingPreambleOverride =
			`You are an intelligent Routing Assistant for a HRMS Leave Management Framework. Your task is to determine if there is sufficient information in the user query to extract data for the given parameters. 

		Instructions:
		1. Analyze the user query for information related to leave requests.
		2. Consider the following parameters: leave type, start date, end date.
		3. Start and End date are related to the leave dates i.e., the start and end dates. If Only one date is provided, consider it that both the start and end date are the same.
		4. Respond ONLY with "Yes" or "No" or "cancel" or "confirmation.
		   - "Yes" if there is enough information to extract at least one parameter.
		   - "No" if there is insufficient information to extract any parameter.
			 - "cancel" if the user wants to cancel the leave request or asks questions outside the scope of the leave request.
			 - "confirmation" if the user wants to confirm the leave details and don't ask any other information. For this check the prompt that was provided to the user.

		Error Handling:
		- If the query is unclear or ambiguous, respond with "No".
		- If you're unsure about the information provided, respond with "No".
		- Do not attempt to infer or guess missing information.

		Remember: Your response must be ONLY "Yes" or "No". Do not provide any explanations or additional text.`.replace(
				/\\t/g,
				''
			);

		const prompt = `User Query: ${userMessage.text}
			Prompt That was provided to User: ${context.variable('testResponse')}
			Extracted Information: ${extractedInfo}

		Based on the user query and the extracted information, determine if there is enough information to extract data for any of the following parameters:
		- Leave Type: The type of leave that the user is requesting for.
		- Start Date: The start date of the leave that the user is requesting for.
		- End Date: The end date of the leave that the user is requesting for.

		If any dates are provided, they are related to the leave dates i.e., the start and end dates.

		Respond only with "Yes" if there's enough information to extract at least one parameter, or "No" if there's insufficient information to extract any parameter or "cancel" if the user wants to cancel the leave request or asks questions outside the scope of the leave request or "confirmation" if the user wants to confirm the leave details and don't ask any other information.
		
		`;

		let response = await chat(prompt, {
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
			preambleOverride: routingPreambleOverride,
		});
		console.log(extractedInfo);
		response = response.chatResponse.text.toLowerCase();
		if (response === 'yes') {
			context.keepTurn(true);
			context.transition('extraction');
		} else if (response === 'no') {
			context.keepTurn(true);
			context.transition('prompt');
		} else if (response === 'cancel') {
			context.keepTurn(true);
			context.setVariable('validExtractedInfo', JSON.stringify({}));
			context.setVariable('nullExtractedInfo', JSON.stringify({}));
			context.setVariable('extractedInfo', JSON.stringify({}));
			context.transition('initial');
		} else if (response === 'confirmation') {
			context.keepTurn(true);
			context.reply('I have forwarded your leave Request.');
			context.keepTurn(true);
			context.transition();
		}

		done();
	},
};
