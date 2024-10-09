const leaveTypes = ['Annual Leave', 'Sick Leave', 'Remote Working Leave'];

const leaveTypeParams = {
	'Annual Leave': ['leaveDestination', 'advanceLeaveSalary'],
	'Sick Leave': ['medicalCertificate'],
	'Remote Working Leave': ['workLocation'],
};

function getLeaveTypeParams(leaveType) {
	return leaveTypeParams[leaveType] || [];
}

module.exports = {
	leaveTypes,
	getLeaveTypeParams,
};
