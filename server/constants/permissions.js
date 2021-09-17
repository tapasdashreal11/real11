'use strict';

const GROUP_PERMISSIONS = {
  USER: 'User',
  ADMIN : 'Admin',
};

const TransactionTypesByValues =  [
  "",
  "Deposited Cash",
  "Mobile Verified",
  "Joined A Contest",
  "Won A contest",
  "Friend Joined Contests",
  "Contest Cancelled",
  "Level Up Cash Credited",
  "Coupon Bonus",
  "Withdrawal",
  "Friend Used Invite Code",
  "Withdraw Pending",
  "Withdraw Rejected",
  "Withdraw Confirmed",
  "Admin Added",
  "Admin Deducted",
  "Join League Referral Bonus",
  "Match Cancelled",
  "Tax Deducted at Source",
  "Extra Amount",
  "Team clash bonus",
  "Extra Deposite",
  "First Deposite Bonus",
  "Coupon Purchase",
  "Weekly Leaderboard Reward",
  "Friend First Time Deposit Reward",
  "Signup Bonus Reward",
  "Signup Xtra Cash Reward",
  "Affiliate Amount In Deposit",
  "Affiliate Amount Withdraw In Deposit",
  "Won free-giveaway In Deposite",
  "Series Leaderboard Reward"
];

module.exports = {
  GROUP_PERMISSIONS: GROUP_PERMISSIONS,
  transaction_type : TransactionTypesByValues
};
