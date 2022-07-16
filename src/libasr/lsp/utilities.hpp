#ifndef UTILITIES_HPP
#define UTILITIES_HPP

#include <string>
#include <iostream>
#include <ostream>


class Logger {
    private:
        std::string file_name;
        std::FILE* file;
    public:
        Logger() {
            this->file_name = "/home/ankita/Documents/cpp_logs.log";
        }

        void log(std::string message) {
            message += "\n";
            std::FILE* file = std::fopen(this->file_name.c_str(), "a");
            std::fwrite(message.data(), sizeof(message[0]), message.size(), file);
            this->exit(file);
        }

        void exit(std::FILE* file) {
            std::fclose(file);
        }
};
#endif