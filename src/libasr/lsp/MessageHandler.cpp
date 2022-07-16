#include "MessageHandler.hpp"

namespace LFortran::LPython {
       
       std::vector<lsp_symbols> get_SymbolLists(const std::string &infile,
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
               std::vector<lsp_symbols> symbol_list = get_symbol_locations(al, *ast, diagnostics, true, infile, lm);
               return symbol_list;
       }

       std::vector<LFortran::diag::lsp_highlight> get_Diagnostics(const std::string &infile,
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
               LFortran::Result<LFortran::ASR::TranslationUnit_t*> r = LFortran::LPython::python_ast_to_asr(al, *ast, diagnostics, true,
            compiler_options.disable_main, compiler_options.symtab_only, infile);
               auto diag_list = diagnostics.lsp_diagnostics(input, lm, compiler_options);
               return diag_list;
       }
}

