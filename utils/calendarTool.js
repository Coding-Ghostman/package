const moment = require('moment');
const { chat } = require('./chat');

class CalendarTool {
	constructor(config = {}) {
		this.currentDate = moment();
		this.holidays = config.holidays || [];
		this.workingDays = config.workingDays || [1, 2, 3, 4, 5]; // Monday to Friday by default
	}

	/**
	 * Interprets various date-related queries in natural language using LLM
	 * @param {string} query - Natural language query about dates
	 * @returns {Object} Interpreted date information
	 */
	async interpretDateQuery(query) {
		const normalizedQuery = query.toLowerCase().trim();
		const response = {
			originalQuery: query,
			currentDate: this.currentDate.format('YYYY-MM-DD'),
			interpretedStartDate: null,
			interpretedEndDate: null,
			description: '',
			relativeDate: null,
			error: null,
		};

		// Define keywords that indicate date-related queries
		const dateKeywords = ['today', 'tomorrow', 'yesterday', 'next', 'last', 'this', 'week', 'month', 'year', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

		// Check if the query contains any date-related keywords
		const containsDateKeyword = dateKeywords.some(keyword => normalizedQuery.includes(keyword));

		// If the query doesn't contain any date-related keywords, return the response without interpretation
		if (!containsDateKeyword) {
			return response;
		}

		try {
			// Generate the next 60 days calendar
			let calendarDays = '';
			for (let i = 0; i < 60; i++) {
				const day = this.currentDate.clone().add(i, 'days');
				calendarDays += `${day.format('YYYY-MM-DD')} (${day.format('dddd')})\n`;
			}

			const prompt = `
Interpret the following date-related query and provide a structured response:
Query: "${query}"
Current date: ${this.currentDate.format('YYYY-MM-DD')}

Calendar for the next 60 days:
${calendarDays}

IMPORTANT RULES:
1. Only consider weekdays (Monday to Friday) for leave periods.
2. Weekends (Saturday and Sunday) are not included in leave periods.
3. The "first week" of a month starts on the first Monday of that month and ends on the following Friday.
4. If a date falls on a weekend, adjust it to the next available weekday.
5. For multi-day leave periods, always start on a Monday and end on a Friday.
6. DO NOT assume any dates if they are not explicitly mentioned in the query.
7. If the query is about a future month or week, make sure to interpret it correctly.
8. If no specific dates or relative time periods are mentioned, return null for both interpretedStartDate and interpretedEndDate.

Provide the interpretation in the following JSON format:
{
  "interpretedStartDate": "YYYY-MM-DD",
  "interpretedEndDate": "YYYY-MM-DD",
  "description": "Brief description of the interpreted date range",
  "relativeDate": "Relative description if applicable (e.g., 'next Monday', 'first week of next month')"
}

If no specific dates can be determined from the query, set interpretedStartDate and interpretedEndDate to null.
Ensure that the interpretedStartDate and interpretedEndDate strictly follow the rules above.
`;

			const chatResponse = await chat(prompt, {
				maxTokens: 300,
				temperature: 0,
			});

			const interpretation = JSON.parse(chatResponse.chatResponse.text);

			// Merge the LLM interpretation with our response object
			Object.assign(response, interpretation);

			// Convert interpretedStartDate and interpretedEndDate to moment objects if they exist
			if (response.interpretedStartDate) {
				response.startDate = moment(response.interpretedStartDate);
				response.startDateFormatted = this.formatDateInWords(response.startDate);
				response.startDateIso8601 = response.startDate.format('YYYY-MM-DD');
			}

			if (response.interpretedEndDate) {
				response.endDate = moment(response.interpretedEndDate);
				response.endDateFormatted = this.formatDateInWords(response.endDate);
				response.endDateIso8601 = response.endDate.format('YYYY-MM-DD');
			}

			// Calculate working days if both start and end dates are present
			if (response.startDate && response.endDate) {
				response.workingDays = this.getWorkingDays(response.startDate, response.endDate);
			}
		} catch (error) {
			response.error = `Failed to interpret date query: ${error.message}`;
		}

		return response;
	}

	/**
	 * Checks if a given date is a holiday
	 * @param {moment.Moment} date - Date to check
	 * @returns {boolean}
	 */
	isHoliday(date) {
		return this.holidays.some((holiday) => {
			const holidayDate = moment(holiday.date);
			return holidayDate.isSame(date, 'day');
		});
	}

	/**
	 * Gets the next working day, considering holidays
	 * @param {moment.Moment} date - Starting date
	 * @returns {moment.Moment}
	 */
	getNextWorkingDay(date) {
		let nextDay = date.clone().add(1, 'day');
		while (!this.isWorkingDay(nextDay)) {
			nextDay.add(1, 'day');
		}
		return nextDay;
	}

	/**
	 * Checks if a given date is a working day
	 * @param {moment.Moment} date - Date to check
	 * @returns {boolean}
	 */
	isWorkingDay(date) {
		return this.workingDays.includes(date.day()) && !this.isHoliday(date);
	}

	/**
	 * Gets the last working day of the month
	 * @param {moment.Moment} date - Any date in the target month
	 * @returns {moment.Moment}
	 */
	getLastWorkingDayOfMonth(date) {
		const lastDay = date.clone().endOf('month');
		while (!this.isWorkingDay(lastDay)) {
			lastDay.subtract(1, 'day');
		}
		return lastDay;
	}

	/**
	 * Adds a specified number of working days to a date
	 * @param {moment.Moment} startDate - Starting date
	 * @param {number} days - Number of working days to add
	 * @returns {moment.Moment}
	 */
	addWorkingDays(startDate, days) {
		let date = startDate.clone();
		let workingDaysAdded = 0;

		while (workingDaysAdded < days) {
			date.add(1, 'day');
			if (this.isWorkingDay(date)) {
				workingDaysAdded++;
			}
		}

		return date;
	}

	/**
	 * Calculates working days between two dates
	 * @param {string|moment.Moment} startDate - Start date
	 * @param {string|moment.Moment} endDate - End date
	 * @returns {number}
	 */
	getWorkingDays(startDate, endDate) {
		const start = moment.isMoment(startDate) ? startDate : moment(startDate);
		const end = moment.isMoment(endDate) ? endDate : moment(endDate);

		let workingDays = 0;
		let currentDate = start.clone();

		while (currentDate <= end) {
			if (this.isWorkingDay(currentDate)) {
				workingDays++;
			}
			currentDate.add(1, 'day');
		}

		return workingDays;
	}

	/**
	 * Returns date in a human-readable format
	 * @param {moment.Moment} date - Date to format
	 * @returns {string}
	 */
	formatDateInWords(date) {
		return moment(date).format('dddd, D MMMM YYYY');
	}

	/**
	 * Returns tool's capabilities for LLM agents
	 * @returns {Object}
	 */
	getCapabilities() {
		return {
			name: 'CalendarTool',
			description: 'A tool for date calculations and working day management',
			functions: [
				{
					name: 'interpretDateQuery',
					description: 'Interprets natural language date queries',
					parameters: ['query'],
				},
				{
					name: 'getNextWorkingDay',
					description: 'Gets the next working day after a given date',
					parameters: ['date'],
				},
				{
					name: 'getWorkingDays',
					description: 'Calculates working days between two dates',
					parameters: ['startDate', 'endDate'],
				},
				// ... other functions
			],
		};
	}
}

module.exports = CalendarTool;
