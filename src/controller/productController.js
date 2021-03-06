const validator = require('../util/validator')
const aws = require('../util/aws')
const productModel = require('../Model/productModel')
//const userModel = require('../Model/userModel')
const currencySymbol = require("currency-symbol-map")
const mongoose = require('mongoose')

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

// //creating product by validating all details.
const createProduct = async function(req, res) {
    try {
        //let files = req.files;
        let requestBody = req.body;
       let productImage = req.files

        //validating empty req body.
        if (!validator.isValidRequestBody(requestBody)) {
            return res.status(400).send({ status: false, message: "Please provide valid request body" })
        }

        //extract params for request body.
        let {  title, description, price, currencyId, currencyFormat, isFreeShipping, style, availableSizes,installments } = requestBody

    
        //validation for the params starts.
        if (!validator.isValid(title)) {
            return res.status(400).send({ status: false, message: "Title is required" })
        }

        //searching title in DB to maintain their uniqueness.
        const istitleAleadyUsed = await productModel.findOne({ title })
        if (istitleAleadyUsed) {
            return res.status(400).send({ status: false, message: `${title} is alraedy in use. Please use another title.` })
        }

        if (!validator.isValid(description)) {
            return res.status(400).send({ status: false, message: "Description is required" })
        }

        if (!validator.isValid(price)) {
            return res.status(400).send({ status: false, message: "Price is required" })
        }

        if (!validator.isValid(currencyId)) {
            return res.status(400).send({ status: false, message: "currencyId is required" })
        }

        if (currencyId != "INR") {
            return res.status(400).send({ status: false, message: "currencyId should be INR" })
        }

        if (!validator.isValid(currencyFormat)) {
            currencyFormat = currencySymbol('INR')
        }
        currencyFormat = currencySymbol('INR') //used currency symbol package to store INR symbol.

        if (style) {
            if (!validator.validString(style)) {
                return res.status(400).send({ status: false, message: "style is required" })
            }
        }

        if (installments) {
            if (!validator.validInstallment(installments)) {
                return res.status(400).send({ status: false, message: "installments can't be a decimal number " })
            }
        }

        if (isFreeShipping) {
            if (typeof isFreeShipping != "boolean") {
                return res.status(400).send({status: false,message: `isFreeShipping must be either 'true' or 'false'.`})}
        }

        if (!(productImage && productImage.length > 0)) {
            return res.status(400).send({ status: false, msg: "Invalid request parameters. Provide productImage." });
        }

          productImage = await aws.uploadFile(productImage[0]);


        //object destructuring for response body.
        const newProductData = {
            title,
            description,
            price,
            currencyId,
            currencyFormat: currencyFormat,
            isFreeShipping,
            style,
            availableSizes,
            installments,
            productImage: productImage
        }

        //validating sizes to take multiple sizes at a single attempt.
        if (availableSizes) {
            let sizesArray = availableSizes.split(",").map(x => x.trim())

            for (let i = 0; i < sizesArray.length; i++) {
                if (!(["S", "XS", "M", "X", "L", "XXL", "XL"].includes(sizesArray[i]))) {
                    return res.status(400).send({ status: false, message: "AvailableSizes should be among ['S','XS','M','X','L','XXL','XL']" })
                }
            }

            //using array.isArray function to check the value is array or not.
            if (Array.isArray(sizesArray)) {
                newProductData['availableSizes'] = [...new Set(sizesArray)]
            }
    
        }
        const saveProductDetails = await productModel.create(newProductData)
        return res.status(201).send({ status: true, message: "Product added successfully.", data: saveProductDetails })

    } catch (err) {
        return res.status(500).send({status: false, message: "Error is : " + err})}
};
module.exports.createProduct =createProduct

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////


  const getProductProfile = async function (req, res) {
    try {
        const findProduct = await productModel.findById({ _id: req.params.productId, isDeleted: false })
        if (!findProduct) {
            return res.status(400).send({ status: false, msg: "productId does not exists" })
        }
        res.status(200).send({ status: true, data: findProduct })
    } catch (err) {
        res.status(500).send({ status: false, msg: err.message })
    }
}
module.exports.getProductProfile = getProductProfile
///////////////////////////////////////////////////////////////////////////////////////////////////////////

const GetProducts = async function (req, res) {
    try {
        let Size = req.query.Size
        let name = req.query.name
        let priceSort = req.query.priceSort
        let priceGreaterThan = req.query.priceGreaterThan
        let priceLessThan = req.query.priceLessThan
        let priceObj = {}
        if (priceGreaterThan) {
            priceObj["$gt"] = priceGreaterThan
        }
        if (priceLessThan) {
            priceObj["$lt"] = priceLessThan
        }
        if (priceLessThan || priceGreaterThan) {
            let priceSearch = await productModel.find({ price: priceObj, isDeleted: false }).sort({ price: priceSort })
            console.log(priceSearch)
            if (priceSearch.length != 0) {
                return res.status(200).send({ status: true, msg: "Success", data: { priceSearch } })
            } else {
                return res.status(400).send({ status: false, msg: "No matches in this price range found" })
            }
        }
        if (Size) {
            let findSize = await productModel.find({ availableSizes: Size, isDeleted: false }).sort({ price: priceSort })

            if (findSize.length != 0) {
                return res.status(200).send({ status: true, msg: "Success", data: { findSize } })
            } else {
                return res.status(400).send({ status: false, msg: `No products of size ${Size} found` })
            }
        }
        if (name) {
            let findName = await productModel.find({ title: { $regex: name, $options: 'i' }, isDeleted: false }).sort({ price: priceSort })
            // console.log(findName)
            if (findName.length != 0) {
                return res.status(200).send({ status: true, msg: "Success", data: { findName } })
            } else {
                return res.status(400).send({ status: false, msg: `No product of name ${name} found` })
            }
        }

    } catch (err) {
        res.status(500).send({ status: false, msg: err.message })
    }
}
module.exports.GetProducts = GetProducts


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const updateProduct = async function (req, res) {
    try {
        let reqBody = req.body
        const { title, description, price, isFreeShipping, style, availableSizes, installments,productImage } = reqBody
        const findProduct = await productModel.findOne({ _id: req.params.productId, isDeleted: false })
        if (!findProduct) {
            return res.status(404).send({ status: false, msg: "product id does not exists" })
        }
        let files = req.files;
        if (files && files.length > 0) {
            //upload to s3 and return true..incase of error in uploading this will goto catch block( as rejected promise)
            var uploadedFileURL = await aws.uploadFile(files[0]); // expect this function to take file as input and give url of uploaded file as output 
            //   res.status(201).send({ status: true, data: uploadedFileURL });
        }
        const ProductData = {
            title: title, description: description, price: price, currencyId: "???", currencyFormat: "INR",
            isFreeShipping: isFreeShipping, productImage: uploadedFileURL,
            style: style, availableSizes: availableSizes, installments: installments
        }
        let updateProduct = await productModel.findOneAndUpdate({ _id: req.params.productId },
            ProductData, { new: true })
        res.status(200).send({ status: true, msg: 'Success', data: { updateProduct } })


    } catch (err) {
        res.status(500).send({ status: false, msg: err.message })
    }
}
module.exports.updateProduct = updateProduct


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const productDel=async function (req, res){
    try{

        let productId = req.params.productId 
        const Product = await productModel.findById(productId);
        if (Product.isDeleted == true) {
            res.status(400).send({ status: false, msg: "product is already deleted" })
            return
        }

        const find=await productModel.findOneAndUpdate({_id:req.params.productId , isDeleted:false},{isDeleted:true,deletedAt:new Date()},{new:true})
        if(!find){
           return res.status(404).send({status:false,msg:"productId does not exists"})
        }
        res.status(201).send({status:true,data:find})


    }catch(err){
        res.status(500).send({status:false, msg:err.message})
    }
}
module.exports.productDel=productDel
////////////////////////////////////////////////////////////////////////////////////////////////

