const asyncHandler = (requestHandler) =>{
    (re, res, next)=>{
        Promise.resolve(requestHandler(re, res, next)).catch(error => next(error))
    }
}







export {asyncHandler}



//---try catch way ---

/*
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        res.status(error.code || 500).json({
            success: false,
            message: error.message || "Internal Server Error" });
    }
}*/