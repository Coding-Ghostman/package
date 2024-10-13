module.exports = {
	'Annual Leave': {
		name: 'Annual Leave',
		mandatoryParams: [
			{ name: 'startDate', description: 'The start date of the leave' },
			{ name: 'endDate', description: 'The end date of the leave' },
			{
				name: 'startDayType',
				default: true,
				description:
					'Whether the start date is a full day or half day. true for full day, false for half day',
			},
			{
				name: 'endDayType',
				default: true,
				description:
					'Whether the end date is a full day or half day. true for full day, false for half day',
			},
		],
		optionalParams: [
			{
				name: 'leaveDestination',
				default: 'local',
				description:
					'Leave Destination can be local or abroad. Also, Outside the UAE is considered as abroad.',
			},
			{
				name: 'advanceSalary',
				default: false,
				description: 'Whether the advance salary is requested.',
			},
		],
	},
	'Sick Leave': {
		name: 'Sick Leave',
		mandatoryParams: [
			{ name: 'startDate', description: 'The start date of the sick leave' },
			{ name: 'endDate', description: 'The end date of the sick leave' },
		],
		optionalParams: [
			{
				name: 'medicalCertificate',
				default: false,
				description: 'Whether a medical certificate is provided',
			},
			{
				name: 'symptoms',
				default: null,
				description: 'Description of symptoms',
			},
		],
	},
	'Remote Working': {
		name: 'Remote Working',
		mandatoryParams: [
			{ name: 'startDate', description: 'The start date of remote working' },
			{ name: 'endDate', description: 'The end date of remote working' },
			{ name: 'workLocation', description: 'Location of remote work' },
		],
		optionalParams: [
			{
				name: 'reasonForRemote',
				default: 'Flexible working arrangement',
				description: 'Reason for remote working',
			},
			{
				name: 'availableHours',
				default: '9:00 AM - 5:00 PM',
				description: 'Available hours during remote work',
			},
		],
	},
};
