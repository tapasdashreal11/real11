const Users = require("../../../models/user");
const BankDetails = require("../../../models/user-bank-details");
const UserRazopayFundAc = require("../../../models/razopay-contact-fund-ac");
const { ObjectId } = require('mongodb');
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const { razopayUserContact, razopayFundAccount } = require("./razopay-contact-fund-ac");
const moment = require('moment');
const _ = require('lodash');

module.exports = async (req, res) => {
    try {
        var response = { status: false, message: "Invalid Request", data: {} };
        let userId = "6171105acd54863bd0c02c17"; //req.userId;
        let apiList = [Users.findOne({ _id: userId }), BankDetails.findOne({ user_id: userId }), UserRazopayFundAc.findOne({ user_id: userId })];
        var results = await Promise.all(apiList);
        if (results && results.length > 0) {
            let user = results[0] ? results[0] : {};
            let userBankDeatail = results[1] ? results[1] : {};
            let userRazopayData = results[2] ? results[2] : {};
            if (userRazopayData && userRazopayData.contact_id && userRazopayData.fund_account_id) {
                res.send(ApiUtility.failed("You have already verified your account detail!!"));
            }
            if (user.first_name !== '' && user.email !== '' && user.phone !== '' && user.address !== '' && user.city !== user.postal_code !== '') {
                let userContact = {
                    "name": user.first_name,
                    "email": user.email,
                    "contact": user.phone,
                    "type": "customer",
                    "reference_id": "" + userId,
                    "notes": {
                        "random_key_1": "Real11 contact",
                        "random_key_2": "Reall 11 User"
                    }
                };

                let fundAccount = {
                    "account_type": "bank_account",
                    "bank_account": {
                        "name": user.first_name,
                        "ifsc": userBankDeatail.ifsc_code,
                        "account_number": userBankDeatail.account_number,
                    }
                };
                if(_.isEmpty(userRazopayData)){
                    let userContactres = await razopayUserContact(userContact);
                    console.log('userContactres',userContactres);
                    if(userContactres && userContactres.id){
                     fundAccount["contact_id"]= userContactres.id;
                     let userFundRes = await razopayFundAccount(fundAccount);
                     if(userFundRes && userFundRes.id){
                        await UserRazopayFundAc.create({contact_id:userContactres.id,user_id:userId,fund_account_id:userFundRes.id});
                     } else {
                        await UserRazopayFundAc.create({contact_id:userContactres.id,user_id:userId});
                     }
                       response["message"] = "Account successfully verified!!";
                       response["status"] = true;
                       response["data"] = {};
                       return res.json(response);
                    } else {
                        res.send(ApiUtility.failed("Something went wrong with profile!!"));
                    }
                } else {
                    if (userRazopayData && userRazopayData.contact_id){
                        fundAccount["contact_id"]= userRazopayData.contact_id;
                        let userFundRes = await razopayFundAccount(fundAccount);
                        if(userFundRes && userFundRes.id){
                            await UserRazopayFundAc.findOneAndUpdate({user_id:userId},{$set:{fund_account_id:userFundRes.id}});
                            
                            response["message"] = "Account successfully verified!!";
                            response["status"] = true;
                            response["data"] = {};
                            return res.json(response);
                        } else {
                            res.send(ApiUtility.failed("Something went wrong with profile.Please contact with admin!!"));
                        }
                    }
                }
                
            } else {
                res.send(ApiUtility.failed("Please update your profile!!"));
            }
        } else {
            res.send(ApiUtility.failed("Something went wrong!!"));
        }
    } catch (error) {
        logger.error("LOGIN_ERROR", error.message);
        res.send(ApiUtility.failed(error.message));
    }
};