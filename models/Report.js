const mongoose = require('mongoose')

const ReportSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    dateCompleted: {
        type: Date,
        required: true,
    },
    verifiedPhone: {
        type: Boolean,
        required: true,
    }
});

const Report = mongoose.model("ReportMal", ReportSchema)
module.exports = Report;
