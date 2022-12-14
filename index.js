require("dotenv").config()

const express = require('express')
const mongoose = require('mongoose')
const app = express()
const cors = require('cors')

const reportModel = require('./models/Report')
const phoneNumberModel = require('./models/PhoneNumber')
const whiteListModel = require('./models/WhiteList')

const sendCode = require('./utils/twilioUtils').sendCode
const generateCode = require('./utils/codeUtils').generateCode

const CODE_LENGTH = 4;

app.use(express.json())
app.use(express.urlencoded({extended: true,}))
app.use(cors())

mongoose.connect("mongodb+srv://prakuls18:PrakulIsCool@cluster0.j48yxbw.mongodb.net/test", 
{
    useNewURLParser: true,
});

app.get("/email_info/:email_id", async (req, res) => {
    try {
        const reports = await reportModel.find({
            email: req.params.email_id,
            verifiedPhone: true,
        })
        const whiteListed = await whiteListModel.findOne({
            email: req.params.email_id,
        })

        let mostRecentDate = null;
        for (let i = 0; i < reports.length; i++) {
            if (mostRecentDate == null) {
                mostRecentDate = reports[i].dateCompleted
            } else {
                if (reports[i].dateCompleted > mostRecentDate) {
                    mostRecentDate = reports[i].dateCompleted
                }
            }
        }
        res.json({
            whiteListed: whiteListed !== null,
            numReports: reports.length,
            mostRecentDateEpoch: mostRecentDate.getTime(),
        })
    } catch(err) {
        console.log(err);
        res.status(401).json({
            server_error: err,
        })
    }
})

app.post("/multiple_email_info", async (req, res) => {
    try {
        const emailInformation = []
        const emails = req.body.emails;
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i]
            const reports = await reportModel.find({
                email,
                verifiedPhone: true,
            })
            const whiteListed = await whiteListModel.findOne({
                email,
            })

            emailInformation.push({
                email,
                whiteListed: whiteListed !== null,
                numReports: reports.length * 31,
            })

        }

        res.json(emailInformation);

    } catch(err) {
        console.log(err)
        res.status(401).json({
            server_error: err,
        })
    }
})

app.get("/detailed_email_info/:email_id", async (req, res) => {
    try {
        const reports = (await reportModel.find({
            email: req.params.email_id,
            verifiedPhone: true,
        })).filter((emailReport) => {
            return {
                email: emailReport.email,
                description: emailReport.description,
                dateCompleted: emailReport.dateCompleted.getTime(),
            }
        })
        const whiteListed = await whiteListModel.findOne({
            email: req.params.email_id,
        })

        res.json({
            whiteListed: whiteListed !== null,
            numReports: reports.length,
            mostRecentDateEpoch: mostRecentDate.getTime(),
        })
    } catch(err) {
        console.log(err);
        res.status(401).json({
            server_error: err,
        })
    }
})

app.post("/start_report_process", async (req, res) => {
    try {
        const email = req.body.email;
        const description = req.body.description;
        const phoneNumber = req.body.phoneNumber;
        const reportExists = await reportModel.findOne({
            email,
            description,
            phoneNumber,
            verifiedPhone: true,
        });
        if (reportExists) {
            return res.status(401).json({
                message: "report already exists. Can't create another one"
            })
        }
        const phone = await phoneNumberModel.findOne({
            phoneNumber,
        });
        let isPhoneVerified = phone && phone.verifiedPhone
        if (isPhoneVerified == null) {
            isPhoneVerified = false;
        }
        const newReport = await reportModel.create({
            email,
            description,
            phoneNumber,
            dateCompleted: new Date(),
            verifiedPhone: isPhoneVerified,
        }) 
        return res.json({
            reportId: newReport._id,
            verifiedPhone: isPhoneVerified,
        })
    } catch (err) {
        console.log(err);
        res.status(400).json({
            server_error: err,
        })
    }
})

app.post("/generate_code", async (req, res) => {
    const reportId = req.body.reportId;
    console.log(reportId);
    const report = await reportModel.findOne({
        _id: reportId,
    });
    if (!report) {
        return res.status(403).json({
            message: "Request does not exist with provided report id",
        })
    }
    const generatedCode = generateCode(CODE_LENGTH);
    console.log(generatedCode);
    let phone = await phoneNumberModel.findOne({
        phoneNumber: report.phoneNumber,
    });
    if (!phone) {
        phone = await phoneNumberModel.create({
            phoneNumber: report.phoneNumber,
            verified: false,
        })
    }
    phone.code = generatedCode;
    await sendCode(phone.phoneNumber, generatedCode);
    await phone.save();

    res.json({
        phoneNumber: phone.phoneNumber,
    })
})

app.post("/enter_code", async (req, res) => {
    const code = req.body.code;
    const reportId = req.body.reportId;
    const phoneNumber = req.body.phoneNumber;

    const report = await reportModel.findOne({
        _id: reportId,
    })
    if (!report) {
        return res.status(403).json({
            message: "No report",
        })
    }

    const phone = await phoneNumberModel.findOne({
        phoneNumber: phoneNumber,
    })
    if (!phone) {
        return res.status(403).json({
            message: "No phone number",
        })
    }

    if (code === phone.code) {
        phone.verified = true;
        await phone.save();

        report.verifiedPhone = true;
        await report.save();

        return res.json({
            message: "Completed report",
            success: true,
        })
    }
    return res.status(401).json({
        message: "Incorrect code",
    })
})

app.listen(3000, () => {
  console.log(`Example app listening on port 3000`)
})
