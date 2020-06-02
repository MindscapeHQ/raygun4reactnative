require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "rg4rn"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = <<-DESC
                  rg4rn
                   DESC
  s.homepage     = "https://github.com/MindscapeHQ/raygun4reactnative"
  # brief license entry:
  s.license      = "MIT"
  # optional - use expanded license entry instead:
  # s.license    = { :type => "MIT", :file => "LICENSE" }
  s.authors      = { "MindscapeHQ" => "hello@raygun.io" }
  s.platforms    = { :ios => "9.0" }
  s.source       = { :git => "https://github.com/MindscapeHQ/raygun4reactnative.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,c,m,swift}"
  s.requires_arc = true

  s.dependency "React"
  s.dependency "Raygun4iOS"
end

