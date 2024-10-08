'use strict';

// Documentation for writing entity event handlers: https://github.com/oracle/bots-node-sdk/blob/master/ENTITY_EVENT_HANDLER.md

// You can use your favorite http client package to make REST calls, however, the node fetch API is pre-installed with the bots-node-sdk.
// Documentation can be found at https://www.npmjs.com/package/node-fetch
// Un-comment the next line if you want to make REST calls using node-fetch.
// const fetch = require("node-fetch");

module.exports = {
	metadata: {
		name: 'CBE_Handler',
		eventHandlerType: 'ResolveEntities',
		supportedActions: [], // string array of transition actions that might be set by the event handler
	},
	handlers: {
		entity: {
			/**
			 * Generic fallback handler that is called when item-specific prompt or disambiguate handler is not specified for the item currently being resolved.
			 * Used here to provide acknowledgements when a bag item is updated or a bag item value is provided while the user was prompted for another item.
			 *
			 * @param {object} event - event object contains the following properties:
			 * - currentItem: name of item currently being resolved
			 * - promptCount: number of times the user is prompted for current item (only set in case of prompt event)
			 * - disambiguationValues: JSONArray with a list of values for the current item that match the user input only set in case of disambiguate event)
			 * @param {object} context - entity resolution context, see https://oracle.github.io/bots-node-sdk/module-Lib.EntityResolutionContext.html
			 */
			publishMessage: async (event, context) => {
				updatedItemsMessage(context);
				outOfOrderItemsMessage(context);
				context.addCandidateMessages();
			},

			validate: async (event, context) => {
				const logger = context.logger();
				logger.info('EVENT CALLED');
			},
		},

		items: {
			BagItem1: {
				validate: async (event, context) => {
					const logger = context.logger();
					logger.info('EVENT CALLED');
				},
			},
		},
	},
};

/**
 * Helper function to show acknowledgement message when a bag item value is updated.
 * @param {EntityResolutionContext} context
 */
function updatedItemsMessage(context) {
	if (context.getItemsUpdated().length > 0) {
		let message =
			'I have updated' +
			context
				.getItemDefsUpdated()
				.map(
					(item, i) =>
						(i !== 0 ? ' and the ' : ' the ') +
						(item.label || item.name).toLowerCase() +
						' to ' +
						context.getDisplayValue(item.fullName || item.name)
				);
		context.addMessage(message);
	}
}

/**
 * Helper function to show acknowledgement message when a bag item value is provided when user was prompted for another bag item.
 * @param {EntityResolutionContext} context
 */
function outOfOrderItemsMessage(context) {
	if (context.getItemsMatchedOutOfOrder().length > 0) {
		let message =
			'I got' +
			context
				.getItemDefsMatchedOutOfOrder()
				.map(
					(item, i) =>
						(i !== 0 ? ' and the ' : ' the ') +
						(item.label || item.name).toLowerCase() +
						' ' +
						context.getDisplayValue(item.fullName || item.name)
				);
		context.addMessage(message);
	}
}
