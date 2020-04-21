const express = require("express")
const router = express.Router()
const Host = require("../models/host")

router.get("/", async (req,res,next)=>{
    try{
        //Find from database the party id, user name and tracks
        //of a party given the host username.
        let partyDetails = await Host.aggregate([
            { "$match": { id: req.cookies.user} },
            { "$group": {_id: null,
                id: {"$first": "$party.id"},
                name: {"$first": "$name"},
                tracks: {"$push": "$party.tracks"}}
            },
            { "$project": {id: 1, tracks: 1 ,name: 1, _id: 0} }
        ])

        if(!partyDetails || partyDetails.length === 0){
            res.status(404).json({message: "couldn't find host"})
        }

         res.status(200).json(partyDetails)
         res.end();

    }catch(err){
        res.status(500).json({message: err.message})
        res.end();
    }
})

module.exports = router