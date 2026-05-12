require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "owlscope"
  s.version      = package["version"]
  s.summary      = package["description"] || "OwlScope dev-only performance + debug native module."
  s.homepage     = "https://github.com/amilog/owlscope"
  s.license      = "MIT"
  s.author       = { "amilog" => "amillgasimov@gmail.com" }
  s.platform     = :ios, "12.0"
  s.source       = { :git => "https://github.com/amilog/owlscope.git", :tag => "v#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm}"
  s.requires_arc = true

  s.dependency "React-Core"
end
