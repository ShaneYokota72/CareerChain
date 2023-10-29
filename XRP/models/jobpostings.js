const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const Jobposting = new Schema({
    company: String,
    role: String,
    description: String,
    location: String,
    salary: String,
    skills: String,
    creater_s_key: String,
    applicants: [{ 
        type: Schema.Types.ObjectId, 
        ref: 'User' 
      }]
    

}, {
    timestamps: true,  
});

const RoomModel = model('Job', Jobposting);
module.exports = RoomModel;