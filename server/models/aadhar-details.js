const mongoose = require("mongoose");
const { Schema } = mongoose;

const aadhaarDetailsSchema = new Schema({
  status: String,
  message: String,
  ref_id: String,
  care_of: String,
  address: String,
  dob: String,
  email: String,
  gender: String,
  name: String,
  photo_link: String,
  mobile_hash: String,
  split_address: {
    country: String,
    dist: String,
    house: String,
    landmark: String,
    pincode: String,
    postOffice: String,
    state: String,
    street: String,
    subdist: String,
    vtc: String,
  },
  year_of_birth: String,
  mobile_hash: String,
  photo_link: String,
  isVerified: {
    type: Boolean,
    default: false,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
});

aadhaarDetailsSchema.static("addData", async function (aadhaarData) {
  const {
    status,
    message,
    ref_id,
    care_of,
    address,
    dob,
    email,
    gender,
    name,
    photo_link,
    mobile_hash,
    year_of_birth,
    split_address: {
      country,
      dist,
      house,
      landmark,
      pincode,
      postOffice,
      state,
      street,
      subdist,
      vtc,
    },
    user,
    isVerified,
  } = aadhaarData;

  return await this.create({
    status,
    message,
    ref_id,
    care_of,
    address,
    dob,
    email,
    gender,
    name,
    photo_link,
    mobile_hash,
    year_of_birth,
    split_address: {
      country,
      dist,
      house,
      landmark,
      pincode,
      postOffice,
      state,
      street,
      subdist,
      vtc,
    },
    user,
    isVerified,
  });
});

const AadhaarDetails = mongoose.model("AadhaarDetails", aadhaarDetailsSchema);
module.exports = AadhaarDetails;
