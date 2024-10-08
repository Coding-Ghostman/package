module.exports = {
	metadata: {
		name: 'CC_OCI_LLM_Component',
		eventHandlerType: 'LlmComponent',
	},

	handlers: {
		/**
		 * Handler to validate the request payload
		 * @param {ValidateRequestEvent} event
		 * @param {LlmComponentContext} context - LLM context, see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
		 * @returns {boolean} returns true when payload is valid
		 */
		validateRequestPayload: async (event, context) => {
			if (context.getCurrentTurn() === 1 && context.isJsonValidationEnabled()) {
				context.addJSONSchemaFormattingInstruction();
			}
			return true;
		},

		/**
		 * Handler to validate response payload
		 * @param {ValidateResponseEvent} event
		 * @param {LlmComponentContext} context - see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
		 * @returns {boolean} flag to indicate the validation was successful
		 */
		validateResponsePayload: async (event, context) => {
			const response = event.payload;
			console.log('RESPONSE:', response);
			console.log('VALIDATION ENTITIES:', event.validationEntities);
			console.log('ENTITY MATCHES:', JSON.stringify(event.entityMatches));
			console.log('ALL VALIDATION ERRORS:', event.allValidationErrors);
			return true;
		},

		/**
		 * Handler to change the candidate bot messages that will be sent to the user
		 * @param {ChangeBotMessagesLlmEvent} event
		 * @param {LlmComponentContext} context - LLM context, see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
		 * @returns {NonRawMessage[]} returns list of bot messages
		 */

		changeBotMessages: async (event, context) => {
			return event.messages;
		},

		/**
		 * Handler that fires when the Submit action is executed by the user.
		 * Use this handler to add your custom logic to process the LLM response.
		 * @param {SubmitEvent} event
		 * @param {LlmComponentContext} context - LLM context, see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
		 */
		submit: async (event, context) => {},
	},
};
