#property script_show_inputs
#property strict

input string InpSymbols = "";
input bool InpMarketWatchOnly = false;
input bool InpUseCommonFiles = true;
input string InpOutputFile = "FractalFrame\\mt5_symbol_sessions.json";

string JsonEscape(const string value)
{
   string result = "";
   for(int i = 0; i < StringLen(value); i++)
   {
      ushort ch = StringGetCharacter(value, i);
      if(ch == '\\') result += "\\\\";
      else if(ch == '"') result += "\\\"";
      else if(ch == '\r') result += "\\r";
      else if(ch == '\n') result += "\\n";
      else if(ch == '\t') result += "\\t";
      else result += StringSubstr(value, i, 1);
   }
   return result;
}

string SessionText(const datetime from, const datetime to)
{
   return TimeToString(from, TIME_MINUTES) + "-" + TimeToString(to, TIME_MINUTES);
}

string ExportSessionArray(const string symbol, const bool quote)
{
   string output = "[";
   for(int day = 0; day < 7; day++)
   {
      if(day > 0) output += ",";
      output += "\"";
      bool first = true;
      for(uint session = 0; session < 32; session++)
      {
         datetime from = 0;
         datetime to = 0;
         bool ok = quote
            ? SymbolInfoSessionQuote(symbol, (ENUM_DAY_OF_WEEK)day, session, from, to)
            : SymbolInfoSessionTrade(symbol, (ENUM_DAY_OF_WEEK)day, session, from, to);
         if(!ok) break;
         if(!first) output += ", ";
         output += JsonEscape(SessionText(from, to));
         first = false;
      }
      output += "\"";
   }
   output += "]";
   return output;
}

bool SymbolRequested(const string symbol, const string requested)
{
   string normalized = "," + requested + ",";
   StringReplace(normalized, " ", "");
   return StringFind(normalized, "," + symbol + ",") >= 0;
}

void OnStart()
{
   string folder = "FractalFrame";
   int flags = FILE_WRITE | FILE_TXT;
   if(InpUseCommonFiles)
   {
      flags |= FILE_COMMON;
      FolderCreate(folder, FILE_COMMON);
   }
   else
   {
      FolderCreate(folder);
   }

   int handle = FileOpen(InpOutputFile, flags);
   if(handle == INVALID_HANDLE)
   {
      Print("FractalFrame session export failed: FileOpen ", InpOutputFile, " error=", GetLastError());
      return;
   }

   string requested = InpSymbols;
   StringTrimLeft(requested);
   StringTrimRight(requested);
   int total = SymbolsTotal(InpMarketWatchOnly);
   int written = 0;

   FileWriteString(handle, "{\"schemaVersion\":1,\"generatedAt\":\"" + TimeToString(TimeGMT(), TIME_DATE | TIME_SECONDS) + "\",\"symbols\":{");
   for(int index = 0; index < total; index++)
   {
      string symbol = SymbolName(index, InpMarketWatchOnly);
      if(symbol == "") continue;
      if(requested != "" && !SymbolRequested(symbol, requested)) continue;

      if(written > 0) FileWriteString(handle, ",");
      FileWriteString(handle, "\"" + JsonEscape(symbol) + "\":{");
      FileWriteString(handle, "\"quote\":" + ExportSessionArray(symbol, true) + ",");
      FileWriteString(handle, "\"trade\":" + ExportSessionArray(symbol, false));
      FileWriteString(handle, "}");
      written++;
   }
   FileWriteString(handle, "}}");
   FileClose(handle);

   Print("FractalFrame session export completed: ", written, " symbols -> ", InpOutputFile);
}
