import mongoose from "mongoose";

const deliveryAssignSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
    },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop"
    },
    shopOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    brodcastedTo: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    assignTo:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default:null
    },
    status:{
        type:String,
        enum:["brodcasted","assigned","completed"],
        default:"brodcasted"
    },
    acceptedAt:Date
},{timestamps:true})

const DeliveryAssign = mongoose.model("DeliveryAssign", deliveryAssignSchema);

export default DeliveryAssign

