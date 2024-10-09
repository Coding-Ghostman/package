const moment = require('moment');

class ContextManager {
	constructor(context) {
		this.context = context;
	}

	getExtractedInfo() {
		return JSON.parse(this.context.variable('user.extractedInfo') || '{}');
	}

	setExtractedInfo(info) {
		this.context.setVariable('user.extractedInfo', JSON.stringify(info));
	}

	updateExtractedInfo(newInfo) {
		const currentInfo = this.getExtractedInfo();
		const updatedInfo = { ...currentInfo, ...newInfo };
		this.setExtractedInfo(updatedInfo);
	}

	getNullExtractedInfo() {
		return JSON.parse(this.context.variable('nullExtractedInfo') || '{}');
	}

	setNullExtractedInfo(info) {
		this.context.setVariable('nullExtractedInfo', JSON.stringify(info));
	}

	getLastAction() {
		return this.context.variable('lastAction') || 'initial';
	}

	setLastAction(action) {
		this.context.setVariable('lastAction', action);
	}

	getUserMessage() {
		return this.context.getUserMessage().text;
	}

	setTestResponse(response) {
		this.context.setVariable('testResponse', response);
	}

	getTestResponse() {
		return this.context.variable('testResponse');
	}

	reply(message) {
		this.context.reply(message);
	}

	transition(action) {
		this.context.transition(action);
	}

	keepTurn(value) {
		this.context.keepTurn(value);
	}

	formatDate(date) {
		return moment(date).format('YYYY-MM-DD');
	}
}

module.exports = ContextManager;
