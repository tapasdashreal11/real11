'use strict';

module.exports = {
    success: (data, message = 'success') => {
        return {
            "status": true,
            "message": message,
            "data": data
        }
    },
    failed: (message = 'error', data = [], error_code = null) => {
        return {
            "status": false,
            "message": message,
            "error_code": error_code
        }
    }
}
