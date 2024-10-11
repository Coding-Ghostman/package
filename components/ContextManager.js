const moment = require('moment');
const leaveConfig = require('/function/utils/leaveConfig');

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
		return JSON.parse(this.context.variable('user.nullExtractedInfo') || '{}');
	}

	setNullExtractedInfo(info) {
		this.context.setVariable('user.nullExtractedInfo', JSON.stringify(info));
	}

	getLastAction() {
		return this.context.variable('user.lastAction') || 'initial';
	}

	setLastAction(action) {
		this.context.setVariable('user.lastAction', action);
	}

	getUserMessage() {
		return this.context.getUserMessage().text;
	}

	setTestResponse(response) {
		this.context.setVariable('user.testResponse', response);
	}

	getTestResponse() {
		return this.context.variable('user.testResponse');
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

	getPreviousAction() {
		return this.context.variable('user.previousAction') || '';
	}

	setPreviousAction(action) {
		this.context.setVariable('user.previousAction', action);
	}

	getConversationHistory() {
		const history = this.context.variable('user.conversationHistory') || [];
		return history.slice(-15); // Return only the latest 15 messages
	}

	clearConversationHistory() {
		this.context.setVariable('user.conversationHistory', []);
	}

	addToConversationHistory(role, messageOrToolResults) {
		let history = this.getConversationHistory();
		if (role === 'TOOL') {
			history.push({ role, toolResults: messageOrToolResults });
		} else {
			history.push({ role, message: messageOrToolResults });
		}
		this.context.setVariable('user.conversationHistory', history);
	}

	getUserProfile() {
		return this.context.variable('user.profile') || {};
	}
	populateLeaveTypeParams(leaveType) {
		const config = this.getLeaveTypeConfig(leaveType);
		if (!config) return null;

		const extractedInfo = this.getExtractedInfo();
		const nullExtractedInfo = this.getNullExtractedInfo();

		// Populate mandatory parameters
		config.mandatoryParams.forEach((param) => {
			if (!(param.name in extractedInfo)) {
				if ('default' in param) {
					extractedInfo[param.name] = param.default;
					nullExtractedInfo[param.name] = false;
				} else {
					extractedInfo[param.name] = null;
					nullExtractedInfo[param.name] = true;
				}
			}
		});

		// Populate optional parameters with default values
		config.optionalParams.forEach((param) => {
			if (!(param.name in extractedInfo)) {
				extractedInfo[param.name] = param.default;
				nullExtractedInfo[param.name] = false;
			}
		});

		// Add leaveType to extractedInfo and nullExtractedInfo
		extractedInfo.leaveType = leaveType;
		nullExtractedInfo.leaveType = false;

		this.setExtractedInfo(extractedInfo);
		this.setNullExtractedInfo(nullExtractedInfo);

		return { extractedInfo, nullExtractedInfo };
	}

	getLeaveTypeConfig(leaveType) {
		if (!leaveType) return null;
		const normalizedLeaveType = Object.keys(leaveConfig).find(
			(key) => key.toLowerCase() === leaveType.toLowerCase()
		);
		return normalizedLeaveType ? leaveConfig[normalizedLeaveType] : null;
	}
}

module.exports = ContextManager;
