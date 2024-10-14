const moment = require('moment');
const { chat } = require('./chat');
const { extractJsonObject } = require('./utils');

class CalendarTool {
	constructor(config = {}) {
		this.currentDate = moment();
		this.holidays = config.holidays || [];
		this.workingDays = config.workingDays || [1, 2, 3, 4, 5]; // Monday to Friday by default
		this.useLlama = config.useLlama || false;
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
			currentDate: `${this.currentDate.format('YYYY-MM-DD')} (${this.currentDate.format('dddd')})`,
			interpretedStartDate: null,
			interpretedEndDate: null,
			description: '',
			relativeDate: null,
			error: null,
		};

		// Define keywords that indicate date-related queries
		const dateKeywords = [
			'today',
			'tomorrow',
			'yesterday',
			'next',
			'last',
			'this',
			'week',
			'month',
			'year',
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday',
			'sunday',
		];

		// Check if the query contains any date-related keywords
		const containsDateKeyword = dateKeywords.some((keyword) =>
			normalizedQuery.includes(keyword)
		);

		// If the query doesn't contain any date-related keywords, return the response without interpretation
		if (!containsDateKeyword) {
			return response;
		}

		try {
			// Generate the next 60 days calendar (weekdays only)
			let calendarDays = '';
			let daysAdded = 0;
			let currentDay = this.currentDate.clone();
			while (daysAdded < 60) {
				if (this.isWorkingDay(currentDay)) {
					calendarDays += `${currentDay.format(
						'YYYY-MM-DD'
					)} (${currentDay.format('dddd')})\n`;
					daysAdded++;
				}
				currentDay.add(1, 'day');
			}

			const prompt = `
Interpret the following date-related query and provide a structured response:
Query: "${query}"
Current date: ${this.currentDate.format('YYYY-MM-DD')}

Calendar for the next 60 weekdays:
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
9. If MULTIPLE LEAVES ARE MENTIONED AND IT CREATES AMBIGUITY, WHERE BOTH THE DATES CAN BE USED FOR A SINGLE DATE PARAMETER, ADD BOTH THE DATES IN AN ARRAY.
10. When a user submits a request that includes a date but it's ambiguous or unclear, the system must gracefully inform the user of the confusion and ask for clarification.
11. If a user mentions a weekend date, adjust it to the next available weekday.

Example prompt for users when clarification is needed:	
"I'm a bit unclear about the date you mentioned. Could you please specify which weekday you'd like to take leave? For example, if you meant 'this Saturday,' I'll interpret that as the following Monday. Your clarification will help me process your request accurately!"

Provide the interpretation in the following JSON format:
{
  "interpretedStartDate": "YYYY-MM-DD",
  "interpretedEndDate": "YYYY-MM-DD",
  "description": "Brief description of the interpreted date range",
  "relativeDate": "Relative description if applicable (e.g., 'next Monday', 'first week of next month')",
  "needsClarification": boolean,
  "clarificationMessage": "Message asking for clarification if needed"
}

If no specific dates can be determined from the query, set interpretedStartDate and interpretedEndDate to null.
Ensure that the interpretedStartDate and interpretedEndDate strictly follow the rules above.
`;

			const chatResponse = await chat(prompt, {
				maxTokens: 300,
				temperature: 0,
				useLlama: this.useLlama,
			});

			let interpretation = null;
			if (this.useLlama) {
				const rawContent =
					chatResponse.chatResponse.choices[0].message.content[0].text
						.replace(/`/g, '')
						.replace('json', '')
						.replace(/\\n/g, '')
						.trim();

				const jsonString = extractJsonObject(rawContent);

				if (jsonString) {
					try {
						interpretation = JSON.parse(jsonString);
					} catch (error) {
						console.error('Error parsing JSON:', error);
						interpretation = null;
					}
				} else {
					console.error('No valid JSON object found in the response');
					interpretation = null;
				}
			} else {
				try {
					interpretation = JSON.parse(chatResponse.chatResponse.text);
				} catch (error) {
					console.error('Error parsing JSON:', error);
					interpretation = null;
				}
			}

			// Merge the LLM interpretation with our response object
			Object.assign(response, interpretation);
			console.log('Calendar Tool: RESPONSE: ', response);

			// Adjust dates to next available weekday if they fall on a weekend
			if (response.interpretedStartDate) {
				response.startDate = this.adjustToWeekday(
					moment(response.interpretedStartDate)
				);
				response.startDateFormatted = this.formatDateInWords(
					response.startDate
				);
				response.startDateIso8601 = response.startDate.format('YYYY-MM-DD');
				response.interpretedStartDate = response.startDateIso8601;
			}

			if (response.interpretedEndDate) {
				response.endDate = this.adjustToWeekday(
					moment(response.interpretedEndDate)
				);
				response.endDateFormatted = this.formatDateInWords(response.endDate);
				response.endDateIso8601 = response.endDate.format('YYYY-MM-DD');
				response.interpretedEndDate = response.endDateIso8601;
			}

			// Calculate working days if both start and end dates are present
			if (response.startDate && response.endDate) {
				response.workingDays = this.getWorkingDays(
					response.startDate,
					response.endDate
				);
			}
		} catch (error) {
			response.error = `Failed to interpret date query: ${error.message}`;
		}

		return response;
	}

	/**
	 * Adjusts a date to the next available weekday if it falls on a weekend
	 * @param {moment.Moment} date - Date to adjust
	 * @returns {moment.Moment}
	 */
	adjustToWeekday(date) {
		while (!this.isWorkingDay(date)) {
			date.add(1, 'day');
		}
		return date;
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
