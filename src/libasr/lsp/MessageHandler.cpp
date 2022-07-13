#include "MessageHandler.hpp"

namespace LFortran::LPython {
       std::vector<lsp_locations> get_SymbolLists(const std::string &infile,
           LCompilers::PassManager& pass_manager,
           const std::string &runtime_library_dir,
           LFortran::CompilerOptions &compiler_options) {
               Allocator al(4*1024);
               LFortran::diag::Diagnostics diagnostics;
               LFortran::LocationManager lm;
               lm.in_filename = infile;
               std::string input = LFortran::read_file(infile);
               lm.init_simple(input);
               LFortran::Result<LFortran::LPython::AST::ast_t*> r1 = LFortran::parse_python_file(
                   al, runtime_library_dir, infile, diagnostics, compiler_options.new_parser);
               LFortran::LPython::AST::ast_t* ast = r1.result;
               std::vector<lsp_locations> symbol_list = get_symbol_locations(al, *ast, diagnostics, true, infile, lm);
               return symbol_list;
       }
}

