#ifndef LPYTHON_SERVER_HPP
#define LPYTHON_SERVER_HPP

#include <string>
#include <rapidjson/document.h>

#include <libasr/asr.h>
#include <lpython/python_ast.h>
#include <libasr/pass/pass_manager.h>
#include <libasr/utils.h>
#include <lpython/semantics/python_ast_to_asr.h>
#include <libasr/diagnostics.h>

#include "JSONRPC2Connection.hpp"
#include "MessageHandler.hpp"
#include "utilities.hpp"

class LPythonServer {
    private:
        Logger log;
    public:
        bool running = false;
        JSONRPC2Connection* conn;
        LPythonServer() {
            this->log = Logger();
            this->running = true;
            this->conn = new JSONRPC2Connection();
        }
        void run(std::string);
        void handle(rapidjson::Document &);
};

#endif