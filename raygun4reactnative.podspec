require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "raygun4reactnative"
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
  s.platforms    = { :ios => "10.0" }
  s.source       = { :git => "https://github.com/hunteva/raygun4reactnative.git", :branch => "kerwin/upstream" }

  s.source_files = "ios/**/*.{h,c,m,swift}"
  s.requires_arc = true

  s.dependency "React"
  s.dependency "raygun4apple"

end

