const moment = require('moment');

class CalendarTool {
	constructor(config = {}) {
		this.currentDate = moment();
		this.holidays = config.holidays || [];
		this.workingDays = config.workingDays || [1, 2, 3, 4, 5]; // Monday to Friday by default
	}

	/**
	 * Interprets various date-related queries in natural language
	 * @param {string} query - Natural language query about dates
	 * @returns {Object} Interpreted date information
	 */
	interpretDateQuery(query) {
		const normalizedQuery = query.toLowerCase().trim();
		const response = {
			originalQuery: query,
			currentDate: this.currentDate.format('YYYY-MM-DD'),
			interpretedDate: null,
			relativeDate: null,
			description: '',
			error: null,
		};

		try {
			// Handle specific date formats
			const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
			const match = normalizedQuery.match(dateRegex);
			if (match) {
				const [, day, month, year] = match;
				const parsedDate = moment(`${year}-${month}-${day}`, 'YYYY-MM-DD');
				if (parsedDate.isValid()) {
					response.interpretedDate = parsedDate;
					response.description = 'Specific date mentioned';
				}
			}

			// Handle relative date queries
			if (!response.interpretedDate) {
				if (normalizedQuery.includes('today')) {
					response.interpretedDate = this.currentDate.clone();
					response.description = 'Today';
				} else if (normalizedQuery.includes('tomorrow')) {
					response.interpretedDate = this.currentDate.clone().add(1, 'day');
					response.description = 'Tomorrow';
				} else if (normalizedQuery.includes('next week')) {
					response.interpretedDate = this.currentDate.clone().add(1, 'week').startOf('week');
					response.description = 'Start of next week';
				} else if (normalizedQuery.includes('next month')) {
					response.interpretedDate = this.currentDate.clone().add(1, 'month').startOf('month');
					response.description = 'Start of next month';
				} else if (normalizedQuery.includes('next working day')) {
					response.interpretedDate = this.getNextWorkingDay(this.currentDate.clone());
					response.description = 'Next working day';
				}
			}

			// Add formatted dates to response if a date was interpreted
			if (response.interpretedDate) {
				response.formattedDate = this.formatDateInWords(response.interpretedDate);
				response.iso8601 = response.interpretedDate.format('YYYY-MM-DD');
				response.dayOfWeek = response.interpretedDate.format('dddd');
				response.isWorkingDay = this.isWorkingDay(response.interpretedDate);
			}

			// Handle duration queries
			const durationMatch = normalizedQuery.match(/(\d+)\s*(day|week|month)/);
			if (durationMatch) {
				const [, amount, unit] = durationMatch;
				response.duration = {
					amount: parseInt(amount),
					unit: unit + (amount > 1 ? 's' : ''),
				};
				response.endDate = response.interpretedDate
					? response.interpretedDate.clone().add(amount, unit)
					: this.currentDate.clone().add(amount, unit);
				response.endDateFormatted = this.formatDateInWords(response.endDate);
				response.endDateIso8601 = response.endDate.format('YYYY-MM-DD');
				response.workingDays = this.getWorkingDays(
					response.interpretedDate || this.currentDate,
					response.endDate
				);
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
