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

	async interpretDateQuery(query) {
		const calendarContext = await this.getCalendar(query);
		const calendarPreamble = `<|begin_of_text|><|start_header_id|>System<|end_header_id|>
<<INSTRUCTIONS>>
1. Only consider weekdays (Monday to Friday) for leave periods.
2. Weekends (Saturday and Sunday) are not included in leave periods. If User mentions a weekend date, adjust it to the next available weekday.
3. If User mentions a date in the past, adjust it to the next available weekday.
4. If User mentions a date range, then check for the starting date and ending date, if they are weekends, adjust them to the next available weekdays.
5. The "first week" of a month starts on the first Monday of that month and ends on the following Friday.
6. If a date falls on a weekend, adjust it to the next available weekday.
7. For multi-day leave periods, always start on a Monday and end on a Friday.
8. DO NOT assume any dates if they are not explicitly mentioned in the query.
9. If the query is about a future month or week, make sure to interpret it correctly.
10. If no specific dates or relative time periods are mentioned, return null for both interpretedStartDate and interpretedEndDate.
11. If MULTIPLE LEAVES ARE MENTIONED AND IT CREATES AMBIGUITY, WHERE BOTH THE DATES CAN BE USED FOR A SINGLE DATE PARAMETER, ADD BOTH THE DATES IN AN ARRAY.s
<<INSTRUCTIONS>>
<|eot_id|>
<|begin_of_text|><|start_header_id|>INTERPRETATION JSON<|end_header_id|>
Provide the interpretation in the following JSON format Strictly follow it, and provide all the keys inside double quotes:
{
  "originalStartDate": "YYYY-MM-DD (Weekday Name)" or null, <- The original start date from the user query
  "originalEndDate": "YYYY-MM-DD (Weekday Name)" or null, <- The original end date from the user query
  "interpretedStartDate": "YYYY-MM-DD (Weekday Name)", <- The interpreted start date
  "interpretedEndDate": "YYYY-MM-DD (Weekday Name)", <- The interpreted end date
  "description": "Brief description of the interpreted date range", <- A brief description of the interpreted date range
  "relativeDate": "Relative description if applicable (e.g., 'next Monday', 'first week of next month')", <- A relative description if applicable
  "adjustedStartDate": "YYYY-MM-DD (Weekday Name)", <- The adjusted start date
  "adjustedEndDate": "YYYY-MM-DD (Weekday Name)", <- The adjusted end date
}
<|eot_id|>`;
		const prompt = `${calendarPreamble}
<|begin_of_text|><|start_header_id|>User Query<|end_header_id|>	
${query}
<|eot_id|>
<|begin_of_text|><|start_header_id|>Current Date<|end_header_id|>
${this.currentDate.format('YYYY-MM-DD')} (${this.currentDate.format('dddd')})
<|eot_id|>
<|begin_of_text|><|start_header_id|>Calendar Context<|end_header_id|>
${calendarContext}
<|eot_id|>`;

		const chatResponse = await chat(prompt, {
			maxTokens: 300,
			temperature: 0,
			useLlama: this.useLlama,
		});

		let interpretation = this.extractInterpretation(chatResponse);
		return this.processInterpretation(interpretation);
	}

	extractInterpretation(chatResponse) {
		if (this.useLlama) {
			const rawContent =
				chatResponse.chatResponse.choices[0].message.content[0].text
					.replace(/`/g, '')
					.replace('json', '')
					.replace(/\\n/g, '')
					.trim();
			console.log(
				'rawContent',
				chatResponse.chatResponse.choices[0].message.content[0].text
			);
			const jsonString = extractJsonObject(rawContent);
			console.log('jsonString', jsonString);
			return jsonString ? JSON.parse(jsonString) : null;
		} else {
			return JSON.parse(chatResponse.chatResponse.text);
		}
	}

	async getCalendar(query) {
		// Use LLM to determine the year and months based on the query
		const calendarPreamble = `<|begin_of_text|><|start_header_id|>System<|end_header_id|>
<<INSTRUCTIONS>>
1. Determine the year and months to be used for the calendar based on the user's query.
2. If a single date is mentioned, then that month and the next month should be considered.
3. Return the year and months in the following JSON format:
{
	"year": 2024,
	"months": [10, 11]
}
<<INSTRUCTIONS>>
<|eot_id|>`;
		const prompt = `<|begin_of_text|><|start_header_id|>User Query<|end_header_id|>
	${query}
	<|eot_id|>
	<|begin_of_text|><|start_header_id|>Current Date<|end_header_id|>
	<<Current date>> ${new Date().toISOString().split('T')[0]} <<Current date>>
	<|eot_id|>
	<|begin_of_text|><|start_header_id|>RESPONSE FORMAT<|end_header_id|>
	{
		"year": 2024,
		"months": [10, 11]
	}
	<|eot_id|>`;
		const useLlama = this.useLlama;
		const chatResponse = await chat(prompt, {
			maxTokens: 100,
			temperature: 0,
			useLlama: useLlama,
			preambleOverride: calendarPreamble,
		});
		let jsonString = '';
		if (useLlama) {
			const rawContent =
				chatResponse.chatResponse.choices[0].message.content[0].text
					.replace(/`/g, '')
					.replace('json', '')
					.replace(/\\n/g, '')
					.trim();
			console.log(
				'Calendar Tool: rawContent',
				chatResponse.chatResponse.choices[0].message.content[0].text
			);
			jsonString = extractJsonObject(rawContent);
		} else {
			jsonString = chatResponse.chatResponse.text
				.replace(/`/g, '')
				.replace('json', '')
				.replace(/\\n/g, '')
				.trim();
		}
		console.log('Calendar Tool: jsonString', jsonString);
		const { year, months } = JSON.parse(jsonString);

		return this.generateCalendar({ year, months });
	}

	async generateCalendar({ year, months }) {
		const isLeapYear = (inputYear) => {
			return (
				(inputYear % 4 === 0 && inputYear % 100 !== 0) || inputYear % 400 === 0
			);
		};

		const getDaysInMonth = (inputYear, month) => {
			const daysInMonth = [
				31,
				isLeapYear(inputYear) ? 29 : 28,
				31,
				30,
				31,
				30,
				31,
				31,
				30,
				31,
				30,
				31,
			];
			return daysInMonth[month - 1];
		};

		const getMonthName = (monthNumber) => {
			const monthNames = [
				'January',
				'February',
				'March',
				'April',
				'May',
				'June',
				'July',
				'August',
				'September',
				'October',
				'November',
				'December',
			];
			return monthNames[monthNumber - 1];
		};

		const calendar = {};
		for (const month of months) {
			const monthName = getMonthName(month);
			calendar[monthName] = [];

			const daysInMonth = getDaysInMonth(year, month);

			for (let day = 1; day <= daysInMonth; day++) {
				const date = new Date(Date.UTC(year, month - 1, day));
				const dayOfWeek = date.getUTCDay();

				// Skip weekends (0 is Sunday, 6 is Saturday)
				if (dayOfWeek !== 0 && dayOfWeek !== 6) {
					calendar[monthName].push({
						date: date.toISOString().split('T')[0],
						dayOfWeek: [
							'Sunday',
							'Monday',
							'Tuesday',
							'Wednesday',
							'Thursday',
							'Friday',
							'Saturday',
						][dayOfWeek],
					});
				}
			}
		}

		return [{ calendar }];
	}

	processInterpretation(interpretation) {
		if (!interpretation) return null;

		const response = {
			originalStartDate: interpretation.originalStartDate,
			originalEndDate: interpretation.originalEndDate,
			interpretedStartDate: this.processDate(
				interpretation.interpretedStartDate
			),
			interpretedEndDate: this.processDate(interpretation.interpretedEndDate),
			description: interpretation.description,
			relativeDate: interpretation.relativeDate,
			needsClarification: interpretation.needsClarification,
			clarificationMessage: interpretation.clarificationMessage,
			isWeekday: {
				originalStartDate: this.isWeekday(interpretation.originalStartDate),
				originalEndDate: this.isWeekday(interpretation.originalEndDate),
				interpretedStartDate: this.isWeekday(
					this.processDate(interpretation.interpretedStartDate)
				),
				interpretedEndDate: this.isWeekday(
					this.processDate(interpretation.interpretedEndDate)
				),
			},
		};

		// if (response.interpretedStartDate && response.interpretedEndDate) {
		// 	response.workingDays = this.getWorkingDays(
		// 		response.interpretedStartDate,
		// 		response.interpretedEndDate
		// 	);
		// }

		return response;
	}

	processDate(date) {
		if (!date) return null;
		if (Array.isArray(date)) {
			return date.map((d) =>
				this.adjustToWeekday(moment(d)).format('YYYY-MM-DD')
			);
		}
		return this.adjustToWeekday(moment(date)).format('YYYY-MM-DD');
	}

	processWeekendAdjustment(adjustment) {
		if (!adjustment) return null;
		const processed = {};
		if (adjustment.startDate) {
			processed.startDate = {
				original: adjustment.startDate.original,
				adjusted: this.adjustToWeekday(
					moment(adjustment.startDate.original)
				).format('YYYY-MM-DD'),
			};
		}
		if (adjustment.endDate) {
			processed.endDate = {
				original: adjustment.endDate.original,
				adjusted: this.adjustToWeekday(
					moment(adjustment.endDate.original)
				).format('YYYY-MM-DD'),
			};
		}
		return processed;
	}

	adjustToWeekday(date) {
		while (!this.isWorkingDay(date)) {
			date.add(1, 'day');
		}
		return date;
	}

	isWorkingDay(date) {
		return this.workingDays.includes(date.day()) && !this.isHoliday(date);
	}

	isWeekday(date) {
		if (!date) return null;
		const momentDate = moment(date);
		return this.workingDays.includes(momentDate.day());
	}

	isHoliday(date) {
		return this.holidays.some((holiday) =>
			moment(holiday.date).isSame(date, 'day')
		);
	}

	getWorkingDays(startDate, endDate) {
		const start = moment(startDate);
		const end = moment(endDate);
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

	getNextWorkingDay(date) {
		let nextDay = moment(date).add(1, 'day');
		while (!this.isWorkingDay(nextDay)) {
			nextDay.add(1, 'day');
		}
		return nextDay.format('YYYY-MM-DD');
	}

	getLastWorkingDayOfMonth(date) {
		const lastDay = moment(date).endOf('month');
		while (!this.isWorkingDay(lastDay)) {
			lastDay.subtract(1, 'day');
		}
		return lastDay.format('YYYY-MM-DD');
	}

	addWorkingDays(startDate, days) {
		let date = moment(startDate);
		let workingDaysAdded = 0;

		while (workingDaysAdded < days) {
			date.add(1, 'day');
			if (this.isWorkingDay(date)) {
				workingDaysAdded++;
			}
		}

		return date.format('YYYY-MM-DD');
	}
}

module.exports = CalendarTool;
