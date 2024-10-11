const moment = require('moment');

class CalendarTool {
	constructor() {
		this.currentDate = moment();
	}

	interpretDateQuery(query) {
		const lowercaseQuery = query.toLowerCase();
		let startDate, endDate, duration;

		if (lowercaseQuery.includes('next week')) {
			startDate = this.getNextWorkingDay(this.currentDate.clone().add(1, 'week').startOf('week'));
			endDate = this.getNextWorkingDay(startDate.clone().add(4, 'days'));
		} else if (lowercaseQuery.includes('this week')) {
			startDate = this.getNextWorkingDay(this.currentDate.clone().startOf('week'));
			endDate = this.getNextWorkingDay(startDate.clone().add(4, 'days'));
		} else if (lowercaseQuery.includes('next month')) {
			startDate = this.getNextWorkingDay(this.currentDate.clone().add(1, 'month').startOf('month'));
			endDate = this.getLastWorkingDayOfMonth(startDate);
		} else if (lowercaseQuery.includes('tomorrow')) {
			startDate = this.getNextWorkingDay(this.currentDate.clone().add(1, 'day'));
			endDate = startDate.clone();
		} else {
			// Default to next working day if no specific time reference is found
			startDate = this.getNextWorkingDay(this.currentDate.clone());
			endDate = startDate.clone();
		}

		if (lowercaseQuery.includes('for')) {
			const durationMatch = lowercaseQuery.match(/for (\d+) (day|week|month)/);
			if (durationMatch) {
				duration = parseInt(durationMatch[1]);
				const unit = durationMatch[2] + 's';
				endDate = this.addWorkingDays(startDate, duration);
			}
		}

		return {
			startDate: startDate.format('YYYY-MM-DD'),
			endDate: endDate.format('YYYY-MM-DD'),
			duration: this.getWorkingDays(startDate, endDate),
			startDateFormatted: this.formatDateInWords(startDate),
			endDateFormatted: this.formatDateInWords(endDate)
		};
	}

	getNextWorkingDay(date) {
		while (date.day() === 0 || date.day() === 6) {
			date.add(1, 'day');
		}
		return date;
	}

	getLastWorkingDayOfMonth(date) {
		const lastDay = date.clone().endOf('month');
		while (lastDay.day() === 0 || lastDay.day() === 6) {
			lastDay.subtract(1, 'day');
		}
		return lastDay;
	}

	addWorkingDays(startDate, days) {
		let date = startDate.clone();
		let workingDays = 0;
		while (workingDays < days) {
			date.add(1, 'day');
			if (date.day() !== 0 && date.day() !== 6) {
				workingDays++;
			}
		}
		return date;
	}

	getWorkingDays(startDate, endDate) {
		// Convert string dates to moment objects if necessary
		const start = moment.isMoment(startDate) ? startDate : moment(startDate);
		const end = moment.isMoment(endDate) ? endDate : moment(endDate);

		let workingDays = 0;
		let currentDate = start.clone();

		while (currentDate <= end) {
			if (currentDate.day() !== 0 && currentDate.day() !== 6) {
				workingDays++;
			}
			currentDate.add(1, 'day');
		}

		return workingDays;
	}

	formatDateInWords(date) {
		return moment(date).format('dddd, D MMMM YYYY');
	}
}

module.exports = CalendarTool;
